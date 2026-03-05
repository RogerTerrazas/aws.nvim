import { describe, it, expect } from 'vitest'
import { parseSkInput, parseFilterInput, inferValueType } from './commands'

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

// ---------------------------------------------------------------------------
// inferValueType
// ---------------------------------------------------------------------------

describe('inferValueType', () => {
  it('should return N for integer strings', () => {
    expect(inferValueType('42')).toBe('N')
    expect(inferValueType('0')).toBe('N')
    expect(inferValueType('-7')).toBe('N')
  })

  it('should return N for decimal strings', () => {
    expect(inferValueType('3.14')).toBe('N')
    expect(inferValueType('99.99')).toBe('N')
    expect(inferValueType('-0.5')).toBe('N')
  })

  it('should return S for plain strings', () => {
    expect(inferValueType('ACTIVE')).toBe('S')
    expect(inferValueType('hello world')).toBe('S')
  })

  it('should return S for empty string', () => {
    expect(inferValueType('')).toBe('S')
  })

  it('should return S for strings that start with a number but are not numeric', () => {
    expect(inferValueType('123abc')).toBe('S')
    expect(inferValueType('1e3x')).toBe('S')
  })
})

// ---------------------------------------------------------------------------
// parseFilterInput
// ---------------------------------------------------------------------------

describe('parseFilterInput', () => {
  describe('empty / no-op input', () => {
    it('should return null for empty string', () => {
      expect(parseFilterInput('')).toBeNull()
    })

    it('should return null for whitespace-only string', () => {
      expect(parseFilterInput('   ')).toBeNull()
    })
  })

  describe('= operator', () => {
    it('should parse "status = ACTIVE" as a string equals filter', () => {
      const result = parseFilterInput('status = ACTIVE')
      expect(result).toEqual({
        expression: '#f = :f',
        attributeNames: { '#f': 'status' },
        attributeValues: { ':f': { S: 'ACTIVE' } },
      })
    })

    it('should infer numeric type for numeric values', () => {
      const result = parseFilterInput('price = 100')
      expect(result?.attributeValues[':f']).toEqual({ N: '100' })
    })
  })

  describe('comparison operators', () => {
    it('should parse "price > 100"', () => {
      const result = parseFilterInput('price > 100')
      expect(result?.expression).toBe('#f > :f')
      expect(result?.attributeNames).toEqual({ '#f': 'price' })
      expect(result?.attributeValues[':f']).toEqual({ N: '100' })
    })

    it('should parse "score >= 50"', () => {
      const result = parseFilterInput('score >= 50')
      expect(result?.expression).toBe('#f >= :f')
    })

    it('should parse "rank < 10"', () => {
      const result = parseFilterInput('rank < 10')
      expect(result?.expression).toBe('#f < :f')
    })

    it('should parse "count <= 5"', () => {
      const result = parseFilterInput('count <= 5')
      expect(result?.expression).toBe('#f <= :f')
    })
  })

  describe('begins_with operator', () => {
    it('should parse "name begins_with Jo"', () => {
      const result = parseFilterInput('name begins_with Jo')
      expect(result).toEqual({
        expression: 'begins_with(#f, :f)',
        attributeNames: { '#f': 'name' },
        attributeValues: { ':f': { S: 'Jo' } },
      })
    })

    it('should preserve spaces in the value', () => {
      const result = parseFilterInput('docId begins_with 9.05.25 Crushed')
      expect(result?.attributeValues[':f']).toEqual({ S: '9.05.25 Crushed' })
    })
  })

  describe('between operator', () => {
    it('should parse "score between 10 AND 20"', () => {
      const result = parseFilterInput('score between 10 AND 20')
      expect(result).toEqual({
        expression: '#f BETWEEN :f1 AND :f2',
        attributeNames: { '#f': 'score' },
        attributeValues: {
          ':f1': { N: '10' },
          ':f2': { N: '20' },
        },
      })
    })

    it('should support string bounds with spaces', () => {
      const result = parseFilterInput(
        'docId between 9.05.25 Crushed AND 9.05.26 Crushed'
      )
      expect(result?.expression).toBe('#f BETWEEN :f1 AND :f2')
      expect(result?.attributeValues[':f1']).toEqual({
        S: '9.05.25 Crushed',
      })
      expect(result?.attributeValues[':f2']).toEqual({
        S: '9.05.26 Crushed',
      })
    })
  })
})
