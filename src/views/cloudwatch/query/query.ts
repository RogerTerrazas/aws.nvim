import type { Buffer, NvimPlugin, Window } from 'neovim'
import { listLogGroups } from '../../../accessors/cloudwatch/log-groups'
import type { LogGroup } from '../../../accessors/cloudwatch/log-groups'
import { initializeCWQueryCommands, submitCWQuery } from './commands'
import type { ViewRegistryEntry } from '../../../types'
import { VIEW_TO_FILETYPE } from '../../../types'
import { getBufferTitle } from '../../../session/index'

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** Cached log groups from the last API call — used by the submit action. */
let cachedLogGroups: LogGroup[] = []

export function getCachedLogGroups(): LogGroup[] {
  return cachedLogGroups
}

// ---------------------------------------------------------------------------
// Buffer builder
// ---------------------------------------------------------------------------

const LOG_GROUPS_SEPARATOR =
  '# ── Log Groups (uncomment to include) ──────────────────────────────────────'
const DOCS_SEPARATOR =
  '# ── Docs ────────────────────────────────────────────────────────────────────'

/**
 * Build the full set of lines for the combined CW Insights query form.
 *
 * Layout:
 *   Time Mode:  relative
 *   Time:       60 minutes
 *   Limit:      1000
 *   Query:
 *   filter @message like //
 *
 *   # ── Log Groups (uncomment to include) ────────────────
 *   # /aws/lambda/my-function
 *   # ...
 *
 *   # ── Docs ──────────────────────────────────────────────
 *   # (usage instructions)
 */
export function buildQueryFormLines(logGroups: LogGroup[]): string[] {
  const lines: string[] = [
    'Time Mode:  relative',
    'Time:       60 minutes',
    'Limit:      1000',
    'Query:',
    'filter @message like //',
    '',
    LOG_GROUPS_SEPARATOR,
  ]

  if (logGroups.length === 0) {
    lines.push('# (no log groups found — add one manually below)')
  } else {
    for (const group of logGroups) {
      lines.push(`# ${group.logGroupName ?? ''}`)
    }
  }

  lines.push('')
  lines.push(DOCS_SEPARATOR)
  lines.push(
    '# Uncomment log groups above to include them in the query (max 50).'
  )
  lines.push(
    '# You can also add log group names manually — one per line, no # prefix.'
  )
  lines.push('#')
  lines.push('# Time Mode: relative or absolute')
  lines.push('#   Relative examples:  "60 minutes"  "24 hours"  "7 days"')
  lines.push('#   Absolute example:   "2024-01-15 TO 2024-01-16 23:59:59"')
  lines.push('#   Date precision: day, hour, minute, or second')
  lines.push('#   Right-hand date defaults to end-of-day if no time is given.')
  lines.push('#')
  lines.push('# Limit: 1–10000 (defaults to 1000)')
  lines.push('#')
  lines.push(
    '# Query: all non-comment lines after "Query:" (above the Log Groups section)'
  )
  lines.push('# Press <CR> on any line to execute. Press q to go back.')

  return lines
}

// ---------------------------------------------------------------------------
// View initializer
// ---------------------------------------------------------------------------

export async function initializeCWQueryView(
  plugin: NvimPlugin,
  window: Window,
  _args?: string[]
): Promise<void> {
  const nvim = plugin.nvim

  try {
    await nvim.outWrite('Loading CloudWatch log groups...\n')
    const logGroups = await listLogGroups()
    cachedLogGroups = logGroups

    const lines = buildQueryFormLines(logGroups)

    const buffer = (await nvim.createBuffer(false, true)) as Buffer

    await nvim.call('nvim_buf_set_option', [buffer, 'buftype', 'nofile'])
    await nvim.call('nvim_buf_set_option', [buffer, 'bufhidden', 'hide'])
    await nvim.call('nvim_buf_set_option', [
      buffer,
      'filetype',
      VIEW_TO_FILETYPE['cloudwatch_query'],
    ])

    // Leave modifiable so user can edit field values and uncomment log groups
    await nvim.call('nvim_buf_set_lines', [buffer, 0, -1, false, lines])

    const bufferTitle = getBufferTitle('CloudWatch Logs Insights')
    await nvim.call('nvim_buf_set_name', [buffer, bufferTitle])

    await nvim.call('nvim_win_set_buf', [window.id, buffer])

    await initializeCWQueryCommands(plugin, buffer)
  } catch (error) {
    await nvim.errWrite(
      `Error loading CloudWatch log groups: ${String(error)}\n`
    )
  }
}

// ---------------------------------------------------------------------------
// Registry entry
// ---------------------------------------------------------------------------

export const cwQueryViewEntry: ViewRegistryEntry = {
  name: 'cloudwatch_query',
  initialize: initializeCWQueryView,
  actions: {
    submit: submitCWQuery,
  },
}
