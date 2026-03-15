import {
  DescribeTableCommand,
  DynamoDBClient,
  KeyType,
  ScalarAttributeType,
} from '@aws-sdk/client-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import { beforeEach, describe, expect, it } from 'vitest'
import { describeTable } from './describe-table'

const ddbMock = mockClient(DynamoDBClient)

describe('describeTable', () => {
  beforeEach(() => {
    ddbMock.reset()
  })

  describe('SUCCESS cases', () => {
    it('should return key schema for a table with only a partition key', async () => {
      ddbMock.on(DescribeTableCommand).resolves({
        Table: {
          TableName: 'my-table',
          KeySchema: [{ AttributeName: 'userId', KeyType: KeyType.HASH }],
          AttributeDefinitions: [
            { AttributeName: 'userId', AttributeType: ScalarAttributeType.S },
          ],
          GlobalSecondaryIndexes: [],
          LocalSecondaryIndexes: [],
        },
      })

      const result = await describeTable('my-table')

      expect(result.tableName).toBe('my-table')
      expect(result.keySchema.partitionKey).toEqual({
        name: 'userId',
        type: 'S',
      })
      expect(result.keySchema.sortKey).toBeUndefined()
      expect(result.globalSecondaryIndexes).toEqual([])
      expect(result.localSecondaryIndexes).toEqual([])
    })

    it('should return key schema for a table with a partition key and sort key', async () => {
      ddbMock.on(DescribeTableCommand).resolves({
        Table: {
          TableName: 'orders-table',
          KeySchema: [
            { AttributeName: 'userId', KeyType: KeyType.HASH },
            { AttributeName: 'timestamp', KeyType: KeyType.RANGE },
          ],
          AttributeDefinitions: [
            { AttributeName: 'userId', AttributeType: ScalarAttributeType.S },
            {
              AttributeName: 'timestamp',
              AttributeType: ScalarAttributeType.N,
            },
          ],
          GlobalSecondaryIndexes: [],
          LocalSecondaryIndexes: [],
        },
      })

      const result = await describeTable('orders-table')

      expect(result.keySchema.partitionKey).toEqual({
        name: 'userId',
        type: 'S',
      })
      expect(result.keySchema.sortKey).toEqual({ name: 'timestamp', type: 'N' })
    })

    it('should return GSI definitions', async () => {
      ddbMock.on(DescribeTableCommand).resolves({
        Table: {
          TableName: 'products-table',
          KeySchema: [{ AttributeName: 'productId', KeyType: KeyType.HASH }],
          AttributeDefinitions: [
            {
              AttributeName: 'productId',
              AttributeType: ScalarAttributeType.S,
            },
            { AttributeName: 'category', AttributeType: ScalarAttributeType.S },
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'category-index',
              KeySchema: [{ AttributeName: 'category', KeyType: KeyType.HASH }],
            },
          ],
          LocalSecondaryIndexes: [],
        },
      })

      const result = await describeTable('products-table')

      expect(result.globalSecondaryIndexes).toHaveLength(1)
      expect(result.globalSecondaryIndexes[0]).toEqual({
        name: 'category-index',
        keySchema: {
          partitionKey: { name: 'category', type: 'S' },
        },
      })
    })
  })

  describe('FAILURE cases', () => {
    it('should throw when DescribeTable call fails', async () => {
      ddbMock.on(DescribeTableCommand).rejects(new Error('Table not found'))

      await expect(describeTable('missing-table')).rejects.toThrow(
        'Table not found'
      )
    })
  })
})
