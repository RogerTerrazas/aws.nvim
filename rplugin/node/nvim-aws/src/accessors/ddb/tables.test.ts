import { describe, it, expect, beforeEach } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb'
import { listDynamoDBTables } from './tables.js'

// Create a mock DynamoDB client
const ddbMock = mockClient(DynamoDBClient)

describe('listDynamoDBTables', () => {
  beforeEach(() => {
    // Reset mock before each test to ensure test isolation
    ddbMock.reset()
  })

  describe('SUCCESS cases', () => {
    it('should return table names when tables exist', async () => {
      // Arrange
      const mockTableNames = ['users-table', 'products-table', 'orders-table']
      ddbMock.on(ListTablesCommand).resolves({
        TableNames: mockTableNames,
      })

      // Act
      const result = await listDynamoDBTables()

      // Assert
      expect(result).toEqual(mockTableNames)
      expect(ddbMock.calls()).toHaveLength(1)
      expect(ddbMock.call(0).args[0].input).toEqual({})
    })

    it('should return empty array when no tables exist', async () => {
      // Arrange
      ddbMock.on(ListTablesCommand).resolves({
        TableNames: [],
      })

      // Act
      const result = await listDynamoDBTables()

      // Assert
      expect(result).toEqual([])
      expect(ddbMock.calls()).toHaveLength(1)
    })

    it('should return undefined when TableNames is not in response', async () => {
      // Arrange
      ddbMock.on(ListTablesCommand).resolves({})

      // Act
      const result = await listDynamoDBTables()

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('ERROR cases', () => {
    it('should throw error when DynamoDB client fails', async () => {
      // Arrange
      const mockError = new Error('DynamoDB connection failed')
      ddbMock.on(ListTablesCommand).rejects(mockError)

      // Act & Assert
      await expect(listDynamoDBTables()).rejects.toThrow(
        'DynamoDB connection failed'
      )
    })
  })
})
