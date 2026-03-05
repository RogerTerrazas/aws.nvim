import type { Buffer, NvimPlugin } from 'neovim'
import { handleRoute } from '../../../router'

// ---------------------------------------------------------------------------
// Time parsing
// ---------------------------------------------------------------------------

interface TimeRange {
  startTime: number // Unix epoch seconds
  endTime: number // Unix epoch seconds
}

/**
 * Parse a flexible date string into a Date object.
 *
 * Supported formats (any precision):
 *   "2024-01-15"                → 2024-01-15 00:00:00 UTC
 *   "2024-01-15 14:00"          → 2024-01-15 14:00:00 UTC
 *   "2024-01-15 14:30:00"       → 2024-01-15 14:30:00 UTC
 *
 * When used as the end of a range and no time component is provided,
 * the caller should default to end-of-day (23:59:59).
 */
function parseFlexibleDate(raw: string, defaultToEndOfDay = false): Date {
  const trimmed = raw.trim()

  // Match: YYYY-MM-DD or YYYY-MM-DD HH:MM or YYYY-MM-DD HH:MM:SS
  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  )

  if (!match) {
    throw new Error(`Unrecognised date format: "${raw}"`)
  }

  const [, year, month, day, hour, minute, second] = match
  const hasTime = hour !== undefined

  if (hasTime) {
    return new Date(
      Date.UTC(
        parseInt(year!),
        parseInt(month!) - 1,
        parseInt(day!),
        parseInt(hour!),
        parseInt(minute ?? '0'),
        parseInt(second ?? '0')
      )
    )
  }

  if (defaultToEndOfDay) {
    return new Date(
      Date.UTC(
        parseInt(year!),
        parseInt(month!) - 1,
        parseInt(day!),
        23,
        59,
        59
      )
    )
  }

  return new Date(
    Date.UTC(parseInt(year!), parseInt(month!) - 1, parseInt(day!), 0, 0, 0)
  )
}

/**
 * Parse the Time field value based on the Time Mode.
 *
 * Relative formats:
 *   "60 minutes" | "24 hours" | "7 days"
 *
 * Absolute format:
 *   "2024-01-15 TO 2024-01-16"
 *   "2024-01-15 14:00 TO 2024-01-16 23:59:59"
 */
export function parseTimeInput(mode: string, timeValue: string): TimeRange {
  const normalizedMode = mode.trim().toLowerCase()

  if (normalizedMode === 'relative') {
    return parseRelativeTime(timeValue)
  }

  if (normalizedMode === 'absolute') {
    return parseAbsoluteTime(timeValue)
  }

  throw new Error(`Unknown Time Mode "${mode}". Use "relative" or "absolute".`)
}

function parseRelativeTime(timeValue: string): TimeRange {
  const trimmed = timeValue.trim().toLowerCase()
  const match = trimmed.match(/^(\d+)\s+(minutes?|hours?|days?)$/)

  if (!match) {
    throw new Error(
      `Unrecognised relative time "${timeValue}". ` +
        'Use formats like "60 minutes", "24 hours", "7 days".'
    )
  }

  const amount = parseInt(match[1]!)
  const unit = match[2]!
  const endTime = Math.floor(Date.now() / 1000)
  let offsetSeconds: number

  if (unit.startsWith('minute')) {
    offsetSeconds = amount * 60
  } else if (unit.startsWith('hour')) {
    offsetSeconds = amount * 3600
  } else {
    offsetSeconds = amount * 86400
  }

  return { startTime: endTime - offsetSeconds, endTime }
}

function parseAbsoluteTime(timeValue: string): TimeRange {
  // Split on " TO " (case-insensitive)
  const toIdx = timeValue.search(/ TO /i)

  if (toIdx === -1) {
    throw new Error(
      `Absolute time must use "START TO END" format. Got: "${timeValue}"`
    )
  }

  const startRaw = timeValue.slice(0, toIdx).trim()
  const endRaw = timeValue.slice(toIdx + 4).trim()

  const startDate = parseFlexibleDate(startRaw, false)
  const endDate = parseFlexibleDate(endRaw, true)

  return {
    startTime: Math.floor(startDate.getTime() / 1000),
    endTime: Math.floor(endDate.getTime() / 1000),
  }
}

// ---------------------------------------------------------------------------
// Form parsing
// ---------------------------------------------------------------------------

function parseFieldValue(line: string): string {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return ''
  return line.slice(colonIdx + 1).trim()
}

/**
 * Extract selected log groups from all buffer lines.
 *
 * In the Log Groups section, lines that do NOT start with '#' and are
 * non-empty (after trimming) are treated as selected log groups.
 * Lines that start with '# ' followed by a path-like string are commented out
 * (i.e. not selected).
 */
export function extractLogGroups(lines: string[]): string[] {
  const groups: string[] = []
  let inLogGroupsSection = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Detect start of log groups section
    if (trimmed.startsWith('# ── Log Groups')) {
      inLogGroupsSection = true
      continue
    }

    // Detect start of docs section — stop collecting
    if (trimmed.startsWith('# ── Docs')) {
      break
    }

    if (!inLogGroupsSection) continue

    // Skip pure comment lines and blank lines
    if (trimmed.startsWith('#') || trimmed === '') continue

    groups.push(trimmed)
  }

  return groups
}

/**
 * Extract the query string from all buffer lines.
 *
 * The query is everything between the "Query:" label and the
 * Log Groups separator, excluding comment lines.
 */
export function extractQueryString(lines: string[]): string {
  const queryLines: string[] = []
  let inQuery = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Start collecting after "Query:" label
    if (!inQuery && trimmed.startsWith('Query:')) {
      // If there's content on the same line after "Query:", include it
      const inline = line.slice(line.indexOf(':') + 1).trim()
      if (inline) queryLines.push(inline)
      inQuery = true
      continue
    }

    if (!inQuery) continue

    // Stop at the log groups separator
    if (trimmed.startsWith('# ── Log Groups')) break

    // Skip pure comment lines and blank lines
    if (trimmed.startsWith('#') || trimmed === '') continue

    queryLines.push(line.trimEnd())
  }

  return queryLines.join('\n').trim()
}

// ---------------------------------------------------------------------------
// Submit action
// ---------------------------------------------------------------------------

/**
 * Action: parse the CW query form buffer and route to the query-results view.
 */
export async function submitCWQuery(plugin: NvimPlugin): Promise<void> {
  const nvim = plugin.nvim

  try {
    const buffer = await nvim.buffer
    const allLines: string[] = await nvim.call('nvim_buf_get_lines', [
      buffer,
      0,
      -1,
      false,
    ])

    // Parse form fields (non-comment lines only for field extraction)
    const getValue = (prefix: string): string => {
      const line = allLines.find((l) =>
        l.trimStart().toLowerCase().startsWith(prefix.toLowerCase())
      )
      return line ? parseFieldValue(line) : ''
    }

    const timeMode = getValue('Time Mode:')
    const timeValue = getValue('Time:')
    const limitRaw = getValue('Limit:')
    const limit = Math.min(10000, Math.max(1, parseInt(limitRaw, 10) || 1000))

    // Parse time range
    let timeRange: TimeRange
    try {
      timeRange = parseTimeInput(timeMode, timeValue)
    } catch (err) {
      await nvim.errWrite(`Time error: ${String(err)}\n`)
      return
    }

    // Extract query string
    const queryString = extractQueryString(allLines)
    if (!queryString) {
      await nvim.errWrite('Query string is required.\n')
      return
    }

    // Extract selected log groups
    const logGroupNames = extractLogGroups(allLines)
    if (logGroupNames.length === 0) {
      await nvim.errWrite(
        'At least one log group must be selected. Uncomment a log group line to include it.\n'
      )
      return
    }

    if (logGroupNames.length > 50) {
      await nvim.errWrite(
        `Too many log groups selected (${logGroupNames.length}). AWS allows a maximum of 50.\n`
      )
      return
    }

    // Route to results view, serialising params as a flat string array
    await handleRoute(plugin, 'cloudwatch_query_results', [
      JSON.stringify(logGroupNames),
      queryString,
      String(timeRange.startTime),
      String(timeRange.endTime),
      String(limit),
    ])
  } catch (error) {
    await nvim.errWrite(`Error submitting query: ${String(error)}\n`)
  }
}

// ---------------------------------------------------------------------------
// Keybindings
// ---------------------------------------------------------------------------

export async function initializeCWQueryCommands(
  plugin: NvimPlugin,
  buffer: Buffer
): Promise<void> {
  const nvim = plugin.nvim

  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    '<CR>',
    '<cmd>NvimAws action submit<CR>',
    {
      noremap: true,
      silent: true,
      desc: 'Execute CloudWatch Logs Insights query',
    },
  ])

  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'q',
    '<C-o>',
    { noremap: true, silent: true, desc: 'Go back to previous view' },
  ])
}
