import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearActiveProfile,
  getActiveProfile,
  getBufferTitle,
  setActiveProfile,
} from './index.js'

describe('session', () => {
  beforeEach(() => {
    clearActiveProfile()
  })

  describe('getActiveProfile / setActiveProfile', () => {
    it('should return null when no profile is set', () => {
      expect(getActiveProfile()).toBeNull()
    })

    it('should return the set profile', () => {
      setActiveProfile({ name: 'staging', region: 'eu-west-1' })

      expect(getActiveProfile()).toEqual({
        name: 'staging',
        region: 'eu-west-1',
      })
    })

    it('should overwrite when set again', () => {
      setActiveProfile({ name: 'staging', region: 'eu-west-1' })
      setActiveProfile({ name: 'production', region: 'us-west-2' })

      expect(getActiveProfile()).toEqual({
        name: 'production',
        region: 'us-west-2',
      })
    })
  })

  describe('clearActiveProfile', () => {
    it('should clear the active profile', () => {
      setActiveProfile({ name: 'staging', region: 'eu-west-1' })
      clearActiveProfile()

      expect(getActiveProfile()).toBeNull()
    })
  })

  describe('getBufferTitle', () => {
    it('should return base title when no profile is active', () => {
      expect(getBufferTitle('DynamoDB Tables')).toBe(
        'nvim-aws | DynamoDB Tables'
      )
    })

    it('should include profile name and region', () => {
      setActiveProfile({ name: 'staging', region: 'eu-west-1' })

      expect(getBufferTitle('DynamoDB Tables')).toBe(
        'nvim-aws | DynamoDB Tables | staging | eu-west-1'
      )
    })

    it('should include only profile name when no region', () => {
      setActiveProfile({ name: 'no-region' })

      expect(getBufferTitle('DynamoDB Tables')).toBe(
        'nvim-aws | DynamoDB Tables | no-region'
      )
    })

    it('should work with any view label', () => {
      setActiveProfile({ name: 'prod', region: 'us-west-2' })

      expect(getBufferTitle('DynamoDB Table: users')).toBe(
        'nvim-aws | DynamoDB Table: users | prod | us-west-2'
      )
    })
  })
})
