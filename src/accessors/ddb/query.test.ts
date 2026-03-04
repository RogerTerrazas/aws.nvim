import { describe, it, expect, beforeEach } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb'
import { queryDynamoDBTable } from './query'

const ddbMock = mockClient(DynamoDBClient)

describe('queryDynamoDBTable', () => {
  beforeEach(() => {
    ddbMock.reset()
  })

  describe('SUCCESS cases', () => {
    it('should return unmarshalled items for a PK-only query', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          { userId: { S: 'user-1' }, name: { S: 'Alice' } },
          { userId: { S: 'user-1' }, name: { S: 'Alice (copy)' } },
        ],
      })

      const result = await queryDynamoDBTable({
        tableName: 'users-table',
        partitionKeyName: 'userId',
        partitionKeyValue: 'user-1',
        partitionKeyType: 'S',
        limit: 50,
      })

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ userId: 'user-1', name: 'Alice' })
    })

    it('should include SK condition when sort key params are provided', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      await queryDynamoDBTable({
        tableName: 'orders-table',
        partitionKeyName: 'userId',
        partitionKeyValue: 'user-1',
        partitionKeyType: 'S',
        sortKeyName: 'timestamp',
        sortKeyValue: '1234567890',
        sortKeyType: 'N',
        limit: 10,
      })

      expect(
        ddbMock.commandCalls(QueryCommand)[0]?.args[0].input
      ).toMatchObject({
        TableName: 'orders-table',
        KeyConditionExpression: '#pk = :pk AND #sk = :sk',
        ExpressionAttributeNames: { '#pk': 'userId', '#sk': 'timestamp' },
        Limit: 10,
      })
    })

    it('should include IndexName when indexName is provided', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      await queryDynamoDBTable({
        tableName: 'products-table',
        indexName: 'category-index',
        partitionKeyName: 'category',
        partitionKeyValue: 'electronics',
        partitionKeyType: 'S',
        limit: 25,
      })

      expect(
        ddbMock.commandCalls(QueryCommand)[0]?.args[0].input
      ).toMatchObject({
        IndexName: 'category-index',
      })
    })

    it('should return empty array when no items found', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      const result = await queryDynamoDBTable({
        tableName: 'empty-table',
        partitionKeyName: 'id',
        partitionKeyValue: 'nonexistent',
        partitionKeyType: 'S',
        limit: 50,
      })

      expect(result).toEqual([])
    })
  })

  describe('FAILURE cases', () => {
    it('should throw when QueryCommand fails', async () => {
      ddbMock.on(QueryCommand).rejects(new Error('Access denied'))

      await expect(
        queryDynamoDBTable({
          tableName: 'restricted-table',
          partitionKeyName: 'id',
          partitionKeyValue: 'val',
          partitionKeyType: 'S',
          limit: 50,
        })
      ).rejects.toThrow('Access denied')
    })
  })
})
