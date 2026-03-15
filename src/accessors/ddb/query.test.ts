import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import { beforeEach, describe, expect, it } from 'vitest'
import { queryDynamoDBTable } from './query'

const ddbMock = mockClient(DynamoDBClient)

const baseParams = {
  tableName: 'orders-table',
  partitionKeyName: 'userId',
  partitionKeyValue: 'user-1',
  partitionKeyType: 'S',
  limit: 10,
} as const

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

    it('should generate #sk = :sk for equals SK condition', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      await queryDynamoDBTable({
        ...baseParams,
        sortKeyName: 'timestamp',
        sortKeyCondition: { operator: '=', value: '1000' },
        sortKeyType: 'N',
      })

      expect(
        ddbMock.commandCalls(QueryCommand)[0]?.args[0].input
      ).toMatchObject({
        KeyConditionExpression: '#pk = :pk AND #sk = :sk',
        ExpressionAttributeNames: { '#pk': 'userId', '#sk': 'timestamp' },
      })
    })

    it('should generate #sk < :sk for less-than SK condition', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      await queryDynamoDBTable({
        ...baseParams,
        sortKeyName: 'timestamp',
        sortKeyCondition: { operator: '<', value: '2000' },
        sortKeyType: 'N',
      })

      expect(
        ddbMock.commandCalls(QueryCommand)[0]?.args[0].input
          .KeyConditionExpression
      ).toBe('#pk = :pk AND #sk < :sk')
    })

    it('should generate #sk <= :sk for less-than-or-equal SK condition', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      await queryDynamoDBTable({
        ...baseParams,
        sortKeyName: 'timestamp',
        sortKeyCondition: { operator: '<=', value: '2000' },
        sortKeyType: 'N',
      })

      expect(
        ddbMock.commandCalls(QueryCommand)[0]?.args[0].input
          .KeyConditionExpression
      ).toBe('#pk = :pk AND #sk <= :sk')
    })

    it('should generate #sk > :sk for greater-than SK condition', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      await queryDynamoDBTable({
        ...baseParams,
        sortKeyName: 'timestamp',
        sortKeyCondition: { operator: '>', value: '500' },
        sortKeyType: 'N',
      })

      expect(
        ddbMock.commandCalls(QueryCommand)[0]?.args[0].input
          .KeyConditionExpression
      ).toBe('#pk = :pk AND #sk > :sk')
    })

    it('should generate #sk >= :sk for greater-than-or-equal SK condition', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      await queryDynamoDBTable({
        ...baseParams,
        sortKeyName: 'timestamp',
        sortKeyCondition: { operator: '>=', value: '500' },
        sortKeyType: 'N',
      })

      expect(
        ddbMock.commandCalls(QueryCommand)[0]?.args[0].input
          .KeyConditionExpression
      ).toBe('#pk = :pk AND #sk >= :sk')
    })

    it('should generate begins_with(#sk, :sk) for begins_with SK condition', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      await queryDynamoDBTable({
        ...baseParams,
        sortKeyName: 'orderId',
        sortKeyCondition: { operator: 'begins_with', value: 'ORDER#' },
        sortKeyType: 'S',
      })

      expect(
        ddbMock.commandCalls(QueryCommand)[0]?.args[0].input
          .KeyConditionExpression
      ).toBe('#pk = :pk AND begins_with(#sk, :sk)')
    })

    it('should generate BETWEEN expression with :sk1 and :sk2 for between SK condition', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      await queryDynamoDBTable({
        ...baseParams,
        sortKeyName: 'score',
        sortKeyCondition: { operator: 'between', value: '10', value2: '20' },
        sortKeyType: 'N',
      })

      const calls = ddbMock.commandCalls(QueryCommand)
      expect(calls).toHaveLength(1)
      // biome-ignore lint/style/noNonNullAssertion: length asserted above
      const input = calls[0]!.args[0].input
      expect(input.KeyConditionExpression).toBe(
        '#pk = :pk AND #sk BETWEEN :sk1 AND :sk2'
      )
      expect(input.ExpressionAttributeValues).toMatchObject({
        ':sk1': { N: '10' },
        ':sk2': { N: '20' },
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
      ).toMatchObject({ IndexName: 'category-index' })
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

    it('should merge filter into QueryCommand when filter is provided', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      await queryDynamoDBTable({
        ...baseParams,
        filter: {
          expression: '#f = :f',
          attributeNames: { '#f': 'status' },
          attributeValues: { ':f': { S: 'ACTIVE' } },
        },
      })

      const input = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input
      expect(input).toMatchObject({
        FilterExpression: '#f = :f',
        ExpressionAttributeNames: { '#pk': 'userId', '#f': 'status' },
        ExpressionAttributeValues: expect.objectContaining({
          ':f': { S: 'ACTIVE' },
        }),
      })
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
