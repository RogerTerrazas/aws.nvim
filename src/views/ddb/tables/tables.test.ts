import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb'
import { initializeDDBTablesView } from '../tables/tables'
import type { NvimPlugin, Window } from 'neovim'

// Create a mock DynamoDB client
const ddbMock = mockClient(DynamoDBClient)

// Mock Neovim plugin instance
function createMockPlugin() {
  const mockBuffer = { id: 1 }
  const mockNvim = {
    createBuffer: vi.fn().mockResolvedValue(mockBuffer),
    call: vi.fn().mockResolvedValue(undefined),
  }

  return {
    nvim: mockNvim,
    registerCommand: vi.fn(),
  } as unknown as NvimPlugin
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

      const mockPlugin = createMockPlugin()
      const mockWindow = { id: 1 } as unknown as Window

      // Act
      await initializeDDBTablesView(mockPlugin, mockWindow)

      // Assert
      expect(mockPlugin.nvim.createBuffer).toHaveBeenCalledWith(true, true)
      expect(mockPlugin.nvim.call).toHaveBeenCalled()
    })
  })

  describe('FAILURE cases', () => {
    it('should throw error when DynamoDB call fails', async () => {
      // Arrange
      const mockError = new Error('DynamoDB connection failed')
      ddbMock.on(ListTablesCommand).rejects(mockError)

      const mockPlugin = createMockPlugin()
      const mockWindow = { id: 1 } as unknown as Window

      // Act & Assert
      await expect(
        initializeDDBTablesView(mockPlugin, mockWindow)
      ).rejects.toThrow('DynamoDB connection failed')
    })
  })
})
