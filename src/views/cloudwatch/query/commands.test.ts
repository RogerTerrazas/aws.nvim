import { describe, it, expect } from 'vitest'
import {
  parseTimeInput,
  extractLogGroups,
  extractQueryString,
} from './commands.js'

// ---------------------------------------------------------------------------
// parseTimeInput — relative
// ---------------------------------------------------------------------------

describe('parseTimeInput (relative)', () => {
  it('should parse minutes correctly', () => {
    const result = parseTimeInput('relative', '60 minutes')
    const nowSec = Math.floor(Date.now() / 1000)

    expect(result.endTime).toBeCloseTo(nowSec, -1)
    expect(result.endTime - result.startTime).toBe(60 * 60)
  })

  it('should parse singular "minute"', () => {
    const result = parseTimeInput('relative', '1 minute')
    expect(result.endTime - result.startTime).toBe(60)
  })

  it('should parse hours correctly', () => {
    const result = parseTimeInput('relative', '24 hours')
    expect(result.endTime - result.startTime).toBe(24 * 3600)
  })

  it('should parse singular "hour"', () => {
    const result = parseTimeInput('relative', '1 hour')
    expect(result.endTime - result.startTime).toBe(3600)
  })

  it('should parse days correctly', () => {
    const result = parseTimeInput('relative', '7 days')
    expect(result.endTime - result.startTime).toBe(7 * 86400)
  })

  it('should parse singular "day"', () => {
    const result = parseTimeInput('relative', '1 day')
    expect(result.endTime - result.startTime).toBe(86400)
  })

  it('should be case-insensitive for mode', () => {
    const result = parseTimeInput('Relative', '30 minutes')
    expect(result.endTime - result.startTime).toBe(30 * 60)
  })

  it('should throw on unrecognised relative format', () => {
    expect(() => parseTimeInput('relative', '5 weeks')).toThrow()
    expect(() => parseTimeInput('relative', 'yesterday')).toThrow()
    expect(() => parseTimeInput('relative', '')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// parseTimeInput — absolute
// ---------------------------------------------------------------------------

describe('parseTimeInput (absolute)', () => {
  it('should parse day-precision dates (start defaults to 00:00:00, end to 23:59:59)', () => {
    const result = parseTimeInput('absolute', '2024-01-15 TO 2024-01-16')

    const start = new Date(result.startTime * 1000)
    const end = new Date(result.endTime * 1000)

    expect(start.toISOString()).toBe('2024-01-15T00:00:00.000Z')
    expect(end.toISOString()).toBe('2024-01-16T23:59:59.000Z')
  })

  it('should parse precise timestamps', () => {
    const result = parseTimeInput(
      'absolute',
      '2024-01-15 14:30:00 TO 2024-01-16 09:00:00'
    )

    const start = new Date(result.startTime * 1000)
    const end = new Date(result.endTime * 1000)

    expect(start.toISOString()).toBe('2024-01-15T14:30:00.000Z')
    expect(end.toISOString()).toBe('2024-01-16T09:00:00.000Z')
  })

  it('should parse start with time, end as day-precision (defaults to 23:59:59)', () => {
    const result = parseTimeInput('absolute', '2024-01-15 14:00 TO 2024-01-16')

    const start = new Date(result.startTime * 1000)
    const end = new Date(result.endTime * 1000)

    expect(start.toISOString()).toBe('2024-01-15T14:00:00.000Z')
    expect(end.toISOString()).toBe('2024-01-16T23:59:59.000Z')
  })

  it('should be case-insensitive for TO separator', () => {
    const result = parseTimeInput('absolute', '2024-01-01 to 2024-01-02')
    expect(result.startTime).toBeLessThan(result.endTime)
  })

  it('should throw when TO separator is missing', () => {
    expect(() => parseTimeInput('absolute', '2024-01-15')).toThrow(
      'Absolute time must use "START TO END" format'
    )
  })

  it('should throw on invalid date format', () => {
    expect(() =>
      parseTimeInput('absolute', 'jan 15 2024 TO jan 16 2024')
    ).toThrow('Unrecognised date format')
  })
})

describe('parseTimeInput (unknown mode)', () => {
  it('should throw on unknown mode', () => {
    expect(() => parseTimeInput('weekly', '7 days')).toThrow(
      'Unknown Time Mode'
    )
  })
})

// ---------------------------------------------------------------------------
// extractLogGroups
// ---------------------------------------------------------------------------

describe('extractLogGroups', () => {
  const buildLines = (logGroupLines: string[]) => [
    'Time Mode:  relative',
    'Time:       60 minutes',
    'Limit:      1000',
    'Query:',
    'filter @message like //',
    '',
    '# ── Log Groups (uncomment to include) ──────────────────────────────────────',
    ...logGroupLines,
    '',
    '# ── Docs ────────────────────────────────────────────────────────────────────',
    '# Some docs',
  ]

  it('should return uncommented lines in the log groups section', () => {
    const lines = buildLines([
      '# /aws/lambda/commented-out',
      '/aws/lambda/selected-fn',
      '/ecs/my-service',
    ])

    const result = extractLogGroups(lines)

    expect(result).toEqual(['/aws/lambda/selected-fn', '/ecs/my-service'])
  })

  it('should return empty array when all groups are commented out', () => {
    const lines = buildLines(['# /aws/lambda/fn-1', '# /aws/lambda/fn-2'])

    expect(extractLogGroups(lines)).toEqual([])
  })

  it('should ignore blank lines in the log groups section', () => {
    const lines = buildLines([
      '',
      '/aws/lambda/fn-1',
      '',
      '/aws/lambda/fn-2',
      '',
    ])

    expect(extractLogGroups(lines)).toEqual([
      '/aws/lambda/fn-1',
      '/aws/lambda/fn-2',
    ])
  })

  it('should stop collecting at the Docs separator', () => {
    const lines = buildLines(['/aws/lambda/fn-1'])
    // Add a "selected" group after docs — should NOT be included
    lines.push('/should/not/appear')

    expect(extractLogGroups(lines)).toEqual(['/aws/lambda/fn-1'])
  })

  it('should return empty array when no log groups section exists', () => {
    const lines = ['Time Mode: relative', 'Query:', 'filter @message like //']
    expect(extractLogGroups(lines)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// extractQueryString
// ---------------------------------------------------------------------------

describe('extractQueryString', () => {
  const buildLines = (queryLines: string[], extraBefore: string[] = []) => [
    'Time Mode:  relative',
    'Time:       60 minutes',
    'Limit:      1000',
    ...extraBefore,
    'Query:',
    ...queryLines,
    '',
    '# ── Log Groups (uncomment to include) ──────────────────────────────────────',
    '# /aws/lambda/fn-1',
  ]

  it('should extract a single-line query', () => {
    const lines = buildLines(['filter @message like //'])
    expect(extractQueryString(lines)).toBe('filter @message like //')
  })

  it('should extract a multi-line query', () => {
    const lines = buildLines([
      'fields @timestamp, @message',
      '| filter @message like /ERROR/',
      '| sort @timestamp desc',
    ])
    expect(extractQueryString(lines)).toBe(
      'fields @timestamp, @message\n| filter @message like /ERROR/\n| sort @timestamp desc'
    )
  })

  it('should skip comment lines within the query section', () => {
    const lines = buildLines(['# This is a comment', 'filter @message like //'])
    expect(extractQueryString(lines)).toBe('filter @message like //')
  })

  it('should skip blank lines within the query section', () => {
    const lines = buildLines(['', 'filter @message like //', ''])
    expect(extractQueryString(lines)).toBe('filter @message like //')
  })

  it('should stop at the Log Groups separator', () => {
    const lines = buildLines(['filter @message like //'])
    expect(extractQueryString(lines)).toBe('filter @message like //')
  })

  it('should return empty string when query section has no content', () => {
    const lines = buildLines([])
    expect(extractQueryString(lines)).toBe('')
  })
})
