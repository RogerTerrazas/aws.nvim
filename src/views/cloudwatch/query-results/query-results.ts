import { QueryStatus } from '@aws-sdk/client-cloudwatch-logs'
import type { Buffer, NvimPlugin, Window } from 'neovim'
import {
  type InsightsQueryParams,
  type InsightsResult,
  runInsightsQuery,
} from '../../../accessors/cloudwatch/query'
import { getBufferTitle } from '../../../session/index'
import type { ViewRegistryEntry } from '../../../types'
import { VIEW_TO_FILETYPE } from '../../../types'
import { logger } from '../../../utils/logger'
import { initializeCWQueryResultsCommands, refreshCWQuery } from './commands'

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
      ? (params.logGroupNames[0] ?? '')
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
    logGroupNames = JSON.parse(args[0] ?? '') as string[]
  } catch {
    await nvim.errWrite('Failed to parse log group names.\n')
    return
  }

  const queryString = args[1] ?? ''
  const startTime = parseInt(args[2] ?? '', 10)
  const endTime = parseInt(args[3] ?? '', 10)
  const limit = parseInt(args[4] ?? '', 10)

  const params: InsightsQueryParams = {
    logGroupNames,
    queryString,
    startTime,
    endTime,
    limit,
  }

  lastQueryParams = params

  logger.info('initializeCWQueryResultsView: start', {
    logGroupCount: logGroupNames.length,
    queryString: queryString.split('\n')[0],
    startTime,
    endTime,
    limit,
  })

  // Create the buffer immediately with a "Running..." placeholder
  const buffer = (await nvim.createBuffer(true, true)) as Buffer

  await nvim.call('nvim_buf_set_option', [buffer, 'buftype', 'nofile'])
  await nvim.call('nvim_buf_set_option', [buffer, 'bufhidden', 'hide'])
  await nvim.call('nvim_buf_set_option', [
    buffer,
    'filetype',
    VIEW_TO_FILETYPE.cloudwatch_query_results,
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

  logger.debug(
    'initializeCWQueryResultsView: placeholder shown, setting buffer in window',
    {
      bufnr: buffer.id,
      windowId: window.id,
      bufferTitle,
    }
  )
  await nvim.call('nvim_win_set_buf', [window.id, buffer])
  logger.info(
    'initializeCWQueryResultsView: placeholder buffer set in window',
    {
      bufnr: buffer.id,
    }
  )

  // Register keymaps before the async query so they're ready immediately
  await initializeCWQueryResultsCommands(plugin, buffer)

  // Run the query and update the buffer
  logger.info('initializeCWQueryResultsView: starting async query', {
    bufnr: buffer.id,
  })

  try {
    const response = await runInsightsQuery(params)

    logger.info(
      'initializeCWQueryResultsView: query complete, updating buffer',
      {
        bufnr: buffer.id,
        resultCount: response.results.length,
        status: response.status,
      }
    )

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

    logger.info('initializeCWQueryResultsView: buffer updated with results', {
      bufnr: buffer.id,
      lineCount: allLines.length,
    })
  } catch (error) {
    logger.error('initializeCWQueryResultsView: query failed', {
      bufnr: buffer.id,
      error: String(error),
    })
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
  bufferLabel: 'CloudWatch Logs Insights — Results',
  initialize: initializeCWQueryResultsView,
  actions: {
    refresh: refreshCWQuery,
  },
}
