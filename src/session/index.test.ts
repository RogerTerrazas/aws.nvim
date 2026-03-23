import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearActiveProfile,
  getActiveProfile,
  getBufferTitle,
  hashQueryParams,
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

  describe('hashQueryParams', () => {
    const BASE_PARAMS = {
      logGroupNames: ['/aws/lambda/my-fn'],
      queryString: 'filter @message like //',
      startTime: 1700000000,
      endTime: 1700003600,
      limit: 100,
    }

    it('should return an 8-character hex string', () => {
      const hash = hashQueryParams(BASE_PARAMS)
      expect(hash).toMatch(/^[0-9a-f]{8}$/)
    })

    it('should return the same hash for identical params', () => {
      expect(hashQueryParams(BASE_PARAMS)).toBe(hashQueryParams(BASE_PARAMS))
    })

    it('should return different hashes for different query strings', () => {
      const other = { ...BASE_PARAMS, queryString: 'fields @message' }
      expect(hashQueryParams(BASE_PARAMS)).not.toBe(hashQueryParams(other))
    })

    it('should return different hashes for different log groups', () => {
      const other = { ...BASE_PARAMS, logGroupNames: ['/aws/lambda/other-fn'] }
      expect(hashQueryParams(BASE_PARAMS)).not.toBe(hashQueryParams(other))
    })

    it('should return different hashes for different time ranges', () => {
      const other = { ...BASE_PARAMS, startTime: 1700007200 }
      expect(hashQueryParams(BASE_PARAMS)).not.toBe(hashQueryParams(other))
    })

    it('should return different hashes for different limits', () => {
      const other = { ...BASE_PARAMS, limit: 500 }
      expect(hashQueryParams(BASE_PARAMS)).not.toBe(hashQueryParams(other))
    })

    it('should treat log group order as irrelevant (sorted before hashing)', () => {
      const a = {
        ...BASE_PARAMS,
        logGroupNames: ['/aws/lambda/alpha', '/aws/lambda/beta'],
      }
      const b = {
        ...BASE_PARAMS,
        logGroupNames: ['/aws/lambda/beta', '/aws/lambda/alpha'],
      }
      expect(hashQueryParams(a)).toBe(hashQueryParams(b))
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
