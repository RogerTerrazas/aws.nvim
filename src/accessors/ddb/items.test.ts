import { describe, it, expect, beforeEach } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb'
import { scanDynamoDBTable } from './items'

const ddbMock = mockClient(DynamoDBClient)

describe('scanDynamoDBTable', () => {
  beforeEach(() => {
    ddbMock.reset()
  })

  describe('without filter', () => {
    it('should scan and return unmarshalled items', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [
          { id: { S: 'abc' }, name: { S: 'Alice' } },
          { id: { S: 'def' }, name: { S: 'Bob' } },
        ],
      })

      const result = await scanDynamoDBTable('my-table', 10)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ id: 'abc', name: 'Alice' })
    })

    it('should pass TableName and Limit to ScanCommand', async () => {
      ddbMock.on(ScanCommand).resolves({ Items: [] })

      await scanDynamoDBTable('my-table', 25)

      expect(ddbMock.commandCalls(ScanCommand)[0]?.args[0].input).toMatchObject(
        {
          TableName: 'my-table',
          Limit: 25,
        }
      )
    })

    it('should return empty array when no items found', async () => {
      ddbMock.on(ScanCommand).resolves({ Items: [] })
      expect(await scanDynamoDBTable('empty', 50)).toEqual([])
    })
  })

  describe('with filter', () => {
    it('should attach FilterExpression and attribute maps to ScanCommand', async () => {
      ddbMock.on(ScanCommand).resolves({ Items: [] })

      await scanDynamoDBTable('my-table', 50, {
        expression: '#f = :f',
        attributeNames: { '#f': 'status' },
        attributeValues: { ':f': { S: 'ACTIVE' } },
      })

      expect(ddbMock.commandCalls(ScanCommand)[0]?.args[0].input).toMatchObject(
        {
          FilterExpression: '#f = :f',
          ExpressionAttributeNames: { '#f': 'status' },
          ExpressionAttributeValues: { ':f': { S: 'ACTIVE' } },
        }
      )
    })

    it('should return filtered unmarshalled items', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [{ id: { S: 'x' }, status: { S: 'ACTIVE' } }],
      })

      const result = await scanDynamoDBTable('my-table', 50, {
        expression: '#f = :f',
        attributeNames: { '#f': 'status' },
        attributeValues: { ':f': { S: 'ACTIVE' } },
      })

      expect(result).toEqual([{ id: 'x', status: 'ACTIVE' }])
    })

    it('should support numeric filter values', async () => {
      ddbMock.on(ScanCommand).resolves({ Items: [] })

      await scanDynamoDBTable('scores-table', 50, {
        expression: '#f > :f',
        attributeNames: { '#f': 'score' },
        attributeValues: { ':f': { N: '100' } },
      })

      expect(ddbMock.commandCalls(ScanCommand)[0]?.args[0].input).toMatchObject(
        {
          FilterExpression: '#f > :f',
          ExpressionAttributeValues: { ':f': { N: '100' } },
        }
      )
    })
  })

  describe('FAILURE cases', () => {
    it('should throw when ScanCommand fails', async () => {
      ddbMock.on(ScanCommand).rejects(new Error('Table not found'))
      await expect(scanDynamoDBTable('missing')).rejects.toThrow(
        'Table not found'
      )
    })
  })
})
