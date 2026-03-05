import { describe, it, expect, beforeEach, vi } from 'vitest'
import { formatProfileLine } from './accounts.js'
import type { AwsProfile } from '../../accessors/config/profiles'

describe('formatProfileLine', () => {
  it('should format an active profile with region', () => {
    const profile: AwsProfile = { name: 'staging', region: 'eu-west-1' }

    const result = formatProfileLine(profile, true, 12)

    expect(result).toBe('▶ staging       eu-west-1')
  })

  it('should format an inactive profile with region', () => {
    const profile: AwsProfile = { name: 'staging', region: 'eu-west-1' }

    const result = formatProfileLine(profile, false, 12)

    expect(result).toBe('  staging       eu-west-1')
  })

  it('should format a profile without region', () => {
    const profile: AwsProfile = { name: 'no-region' }

    const result = formatProfileLine(profile, false, 12)

    expect(result).toBe('  no-region     (no region)')
  })

  it('should pad shorter names to maxNameLen', () => {
    const profile: AwsProfile = { name: 'dev', region: 'us-east-1' }

    const result = formatProfileLine(profile, false, 10)

    expect(result).toBe('  dev         us-east-1')
  })

  it('should handle the default profile', () => {
    const profile: AwsProfile = { name: 'default', region: 'us-east-1' }

    const result = formatProfileLine(profile, true, 7)

    expect(result).toBe('▶ default  us-east-1')
  })
})
