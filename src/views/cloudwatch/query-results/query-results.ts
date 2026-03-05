import type { Buffer, NvimPlugin, Window } from 'neovim'
import {
  runInsightsQuery,
  type InsightsQueryParams,
  type InsightsResult,
} from '../../../accessors/cloudwatch/query'
import { initializeCWQueryResultsCommands, refreshCWQuery } from './commands'
import type { ViewRegistryEntry } from '../../../types'
import { VIEW_TO_FILETYPE } from '../../../types'
import { getBufferTitle } from '../../../session/index'
import { QueryStatus } from '@aws-sdk/client-cloudwatch-logs'

// ---------------------------------------------------------------------------
// Module-level state (for the refresh action)
// ---------------------------------------------------------------------------

let lastQueryParams: InsightsQueryParams | null = null

export function getLastQueryParams(): InsightsQueryParams | null {
  return lastQueryParams
}

// ---------------------------------------------------------------------------
// Result rendering
// ---------------------------------------------------------------------------

function formatTimestamp(epochSeconds: number): string {
  return new Date(epochSeconds * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace('.000Z', ' UTC')
}

function buildResultsHeader(
  params: InsightsQueryParams,
  resultCount: number,
  status: string,
  statistics: Record<string, number | undefined>
): string[] {
  const logGroupsDisplay =
    params.logGroupNames.length === 1
      ? params.logGroupNames[0]!
      : `${params.logGroupNames[0]} (+${params.logGroupNames.length - 1} more)`

  const startDisplay = formatTimestamp(params.startTime)
  const endDisplay = formatTimestamp(params.endTime)

  const lines = [
    `Query:       ${params.queryString.split('\n')[0]}${params.queryString.includes('\n') ? ' ...' : ''}`,
    `Log Groups:  ${logGroupsDisplay}`,
    `Time:        ${startDisplay} → ${endDisplay}`,
    `Status:      ${status}`,
  ]

  const matched = statistics.recordsMatched
  const scanned = statistics.recordsScanned
  if (matched !== undefined || scanned !== undefined) {
    const matchedStr =
      matched !== undefined ? `${Math.round(matched)} matched` : ''
    const scannedStr =
      scanned !== undefined ? `${Math.round(scanned)} scanned` : ''
    lines.push(
      `Stats:       ${[matchedStr, scannedStr].filter(Boolean).join(', ')}`
    )
  }

  lines.push(`Results:     ${resultCount}`)
  lines.push('─'.repeat(80))

  return lines
}

/**
 * Render a single log event as labeled field lines.
 * Fields are sorted with @timestamp and @message first for readability.
 */
function renderEvent(event: InsightsResult): string[] {
  const lines: string[] = []

  // Sort: @timestamp first, @message second, then rest alphabetically
  const priority: Record<string, number> = { '@timestamp': 0, '@message': 1 }
  const entries = Object.entries(event).sort(([a], [b]) => {
    const pa = priority[a] ?? 99
    const pb = priority[b] ?? 99
    if (pa !== pb) return pa - pb
    return a.localeCompare(b)
  })

  for (const [field, value] of entries) {
    // Skip the @ptr field (internal pointer, not useful to display)
    if (field === '@ptr') continue
    lines.push(`${field}: ${value}`)
  }

  return lines
}

// ---------------------------------------------------------------------------
// View initializer
// ---------------------------------------------------------------------------

export async function initializeCWQueryResultsView(
  plugin: NvimPlugin,
  window: Window,
  args?: string[]
): Promise<void> {
  const nvim = plugin.nvim

  if (!args || args.length < 5) {
    await nvim.errWrite(
      'CloudWatch query results view requires query parameters.\n'
    )
    return
  }

  let logGroupNames: string[]
  try {
    logGroupNames = JSON.parse(args[0]!) as string[]
  } catch {
    await nvim.errWrite('Failed to parse log group names.\n')
    return
  }

  const queryString = args[1]!
  const startTime = parseInt(args[2]!, 10)
  const endTime = parseInt(args[3]!, 10)
  const limit = parseInt(args[4]!, 10)

  const params: InsightsQueryParams = {
    logGroupNames,
    queryString,
    startTime,
    endTime,
    limit,
  }

  lastQueryParams = params

  // Create the buffer immediately with a "Running..." placeholder
  const buffer = (await nvim.createBuffer(false, true)) as Buffer

  await nvim.call('nvim_buf_set_option', [buffer, 'buftype', 'nofile'])
  await nvim.call('nvim_buf_set_option', [buffer, 'bufhidden', 'hide'])
  await nvim.call('nvim_buf_set_option', [
    buffer,
    'filetype',
    VIEW_TO_FILETYPE['cloudwatch_query_results'],
  ])

  const placeholderLines = [
    `Running CloudWatch Logs Insights query...`,
    `Log Groups: ${logGroupNames.join(', ')}`,
    `Query: ${queryString.split('\n')[0]}`,
  ]
  await nvim.call('nvim_buf_set_lines', [
    buffer,
    0,
    -1,
    false,
    placeholderLines,
  ])

  const bufferTitle = getBufferTitle('CloudWatch Logs Insights — Results')
  await nvim.call('nvim_buf_set_name', [buffer, bufferTitle])

  await nvim.call('nvim_win_set_buf', [window.id, buffer])

  // Register keymaps before the async query so they're ready immediately
  await initializeCWQueryResultsCommands(plugin, buffer)

  // Run the query and update the buffer
  try {
    const response = await runInsightsQuery(params)

    const headerLines = buildResultsHeader(
      params,
      response.results.length,
      response.status,
      response.statistics as Record<string, number | undefined>
    )

    const resultLines: string[] = []
    if (response.status !== QueryStatus.Complete) {
      resultLines.push(`Query ended with status: ${response.status}`)
    } else if (response.results.length === 0) {
      resultLines.push('(no results)')
    } else {
      for (const event of response.results) {
        resultLines.push(...renderEvent(event))
        resultLines.push('')
      }
      // Remove trailing blank line
      if (resultLines[resultLines.length - 1] === '') {
        resultLines.pop()
      }
    }

    const allLines = [...headerLines, ...resultLines]

    // Make buffer temporarily writable to update content
    await nvim.call('nvim_buf_set_option', [buffer, 'modifiable', true])
    await nvim.call('nvim_buf_set_lines', [buffer, 0, -1, false, allLines])
    await nvim.call('nvim_buf_set_option', [buffer, 'modifiable', false])
  } catch (error) {
    const errorLines = [
      'Error running CloudWatch Logs Insights query:',
      String(error),
      '',
      'Press q to go back.',
    ]
    await nvim.call('nvim_buf_set_option', [buffer, 'modifiable', true])
    await nvim.call('nvim_buf_set_lines', [buffer, 0, -1, false, errorLines])
    await nvim.call('nvim_buf_set_option', [buffer, 'modifiable', false])
  }
}

// ---------------------------------------------------------------------------
// Registry entry
// ---------------------------------------------------------------------------

export const cwQueryResultsViewEntry: ViewRegistryEntry = {
  name: 'cloudwatch_query_results',
  initialize: initializeCWQueryResultsView,
  actions: {
    refresh: refreshCWQuery,
  },
}
