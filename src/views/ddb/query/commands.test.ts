import { describe, it, expect } from 'vitest'
import { parseSkInput } from './commands'

describe('parseSkInput', () => {
  describe('empty / no-op input', () => {
    it('should return null for empty string', () => {
      expect(parseSkInput('')).toBeNull()
    })

    it('should return null for whitespace-only string', () => {
      expect(parseSkInput('   ')).toBeNull()
    })
  })

  describe('bare value defaults to equals', () => {
    it('should parse a bare string value as =', () => {
      expect(parseSkInput('user-123')).toEqual({
        operator: '=',
        value: 'user-123',
      })
    })

    it('should parse a bare numeric string as =', () => {
      expect(parseSkInput('42')).toEqual({ operator: '=', value: '42' })
    })
  })

  describe('explicit = operator', () => {
    it('should parse "= value" as equals', () => {
      expect(parseSkInput('= hello')).toEqual({ operator: '=', value: 'hello' })
    })

    it('should handle extra whitespace after =', () => {
      expect(parseSkInput('=   hello')).toEqual({
        operator: '=',
        value: 'hello',
      })
    })
  })

  describe('< operator', () => {
    it('should parse "< 1000"', () => {
      expect(parseSkInput('< 1000')).toEqual({ operator: '<', value: '1000' })
    })

    it('should not match <= as <', () => {
      expect(parseSkInput('<= 1000')).toEqual({ operator: '<=', value: '1000' })
    })
  })

  describe('<= operator', () => {
    it('should parse "<= 1000"', () => {
      expect(parseSkInput('<= 1000')).toEqual({ operator: '<=', value: '1000' })
    })
  })

  describe('> operator', () => {
    it('should parse "> 500"', () => {
      expect(parseSkInput('> 500')).toEqual({ operator: '>', value: '500' })
    })

    it('should not match >= as >', () => {
      expect(parseSkInput('>= 500')).toEqual({ operator: '>=', value: '500' })
    })
  })

  describe('>= operator', () => {
    it('should parse ">= 500"', () => {
      expect(parseSkInput('>= 500')).toEqual({ operator: '>=', value: '500' })
    })
  })

  describe('begins_with operator', () => {
    it('should parse "begins_with ORDER"', () => {
      expect(parseSkInput('begins_with ORDER')).toEqual({
        operator: 'begins_with',
        value: 'ORDER',
      })
    })

    it('should be case-insensitive for the keyword', () => {
      expect(parseSkInput('BEGINS_WITH hello')).toEqual({
        operator: 'begins_with',
        value: 'hello',
      })
    })

    it('should preserve value casing', () => {
      expect(parseSkInput('begins_with ORDER#2024')).toEqual({
        operator: 'begins_with',
        value: 'ORDER#2024',
      })
    })
  })

  describe('between operator', () => {
    it('should parse "between 10 AND 20" into two values', () => {
      expect(parseSkInput('between 10 AND 20')).toEqual({
        operator: 'between',
        value: '10',
        value2: '20',
      })
    })

    it('should be case-insensitive for the keyword and AND separator', () => {
      expect(parseSkInput('BETWEEN 10 and 20')).toEqual({
        operator: 'between',
        value: '10',
        value2: '20',
      })
    })

    it('should support values with spaces on both sides of AND', () => {
      expect(
        parseSkInput(
          'between 9.05.25 Crushed concrete AND 9.05.26 Crushed concrete'
        )
      ).toEqual({
        operator: 'between',
        value: '9.05.25 Crushed concrete',
        value2: '9.05.26 Crushed concrete',
      })
    })

    it('should support a spaced filename-style SK as the lower bound', () => {
      expect(
        parseSkInput(
          'between 9.05.25 Crushed concrete Lafette.pdf~00003 AND 9.05.26 Crushed concrete Lafette.pdf~00003'
        )
      ).toEqual({
        operator: 'between',
        value: '9.05.25 Crushed concrete Lafette.pdf~00003',
        value2: '9.05.26 Crushed concrete Lafette.pdf~00003',
      })
    })

    it('should use the same value for both bounds when no AND separator is given', () => {
      expect(parseSkInput('between 10')).toEqual({
        operator: 'between',
        value: '10',
        value2: '10',
      })
    })
  })

  describe('values with spaces', () => {
    it('should preserve spaces in bare value (equals)', () => {
      expect(
        parseSkInput('9.05.25 Crushed concrete Lafette.pdf~00003')
      ).toEqual({
        operator: '=',
        value: '9.05.25 Crushed concrete Lafette.pdf~00003',
      })
    })

    it('should preserve spaces after = operator', () => {
      expect(parseSkInput('= my file name.pdf')).toEqual({
        operator: '=',
        value: 'my file name.pdf',
      })
    })

    it('should preserve spaces after > operator', () => {
      expect(parseSkInput('> 2024 Jan report')).toEqual({
        operator: '>',
        value: '2024 Jan report',
      })
    })

    it('should preserve spaces in begins_with value', () => {
      expect(parseSkInput('begins_with 9.05.25 Crushed')).toEqual({
        operator: 'begins_with',
        value: '9.05.25 Crushed',
      })
    })
  })
})
