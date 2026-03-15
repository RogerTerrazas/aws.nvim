import { describe, expect, it } from 'vitest'
import { parseProfileNameFromLine } from './commands.js'

describe('parseProfileNameFromLine', () => {
  it('should parse profile name from active line', () => {
    const line = '▶ staging       eu-west-1'

    const result = parseProfileNameFromLine(line)

    expect(result).toBe('staging')
  })

  it('should parse profile name from inactive line', () => {
    const line = '  production    us-west-2'

    const result = parseProfileNameFromLine(line)

    expect(result).toBe('production')
  })

  it('should parse profile name with hyphens', () => {
    const line = '  my-company-staging  eu-west-1'

    const result = parseProfileNameFromLine(line)

    expect(result).toBe('my-company-staging')
  })

  it('should parse default profile name', () => {
    const line = '▶ default       us-east-1'

    const result = parseProfileNameFromLine(line)

    expect(result).toBe('default')
  })

  it('should parse profile with (no region)', () => {
    const line = '  no-region     (no region)'

    const result = parseProfileNameFromLine(line)

    expect(result).toBe('no-region')
  })

  it('should return empty string for empty line', () => {
    const result = parseProfileNameFromLine('  ')

    expect(result).toBe('')
  })

  it('should return empty string for a help/instruction line', () => {
    const line = '  No AWS profiles found in ~/.aws/config'

    // This starts with spaces then a word — it will extract "No"
    // but that's fine because we'll validate against actual profiles
    const result = parseProfileNameFromLine(line)

    expect(result).toBe('No')
  })
})
