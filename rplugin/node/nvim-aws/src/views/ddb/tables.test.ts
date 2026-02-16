import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb'
import { initializeDDBTablesView } from './tables.js'
import type { Neovim } from 'neovim'

// Create a mock DynamoDB client
const ddbMock = mockClient(DynamoDBClient)

// Mock Neovim instance
function createMockNvim() {
  const mockBuffer = { id: 1 }
  return {
    createBuffer: vi.fn().mockResolvedValue(mockBuffer),
    call: vi.fn().mockResolvedValue(undefined),
  } as unknown as Neovim
}

describe('initializeDDBTablesView', () => {
  beforeEach(() => {
    ddbMock.reset()
  })

  describe('SUCCESS cases', () => {
    it('should initialize view with table names', async () => {
      // Arrange
      const mockTableNames = ['users-table', 'products-table']
      ddbMock.on(ListTablesCommand).resolves({
        TableNames: mockTableNames,
      })

      const mockNvim = createMockNvim()
      const mockWindow = { id: 1 }

      // Act
      await initializeDDBTablesView(mockNvim, mockWindow)

      // Assert
      expect(mockNvim.createBuffer).toHaveBeenCalledWith(false, true)
      expect(mockNvim.call).toHaveBeenCalled()
    })
  })

  describe('FAILURE cases', () => {
    it('should throw error when DynamoDB call fails', async () => {
      // Arrange
      const mockError = new Error('DynamoDB connection failed')
      ddbMock.on(ListTablesCommand).rejects(mockError)

      const mockNvim = createMockNvim()
      const mockWindow = { id: 1 }

      // Act & Assert
      await expect(
        initializeDDBTablesView(mockNvim, mockWindow)
      ).rejects.toThrow('DynamoDB connection failed')
    })
  })
})
