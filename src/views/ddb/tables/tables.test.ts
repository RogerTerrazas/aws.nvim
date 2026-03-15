import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import type { NvimPlugin, Window } from 'neovim'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDDBTablesLines, initializeDDBTablesView } from '../tables/tables'

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

describe('buildDDBTablesLines', () => {
  it('should include each table name as its own line', () => {
    const lines = buildDDBTablesLines(['users-table', 'products-table'])
    expect(lines).toContain('users-table')
    expect(lines).toContain('products-table')
  })

  it('should show a placeholder when no tables exist', () => {
    const lines = buildDDBTablesLines([])
    expect(lines.some((l) => l.includes('no tables found'))).toBe(true)
  })

  it('should always include a keybinding legend', () => {
    const withTables = buildDDBTablesLines(['my-table'])
    const withoutTables = buildDDBTablesLines([])

    for (const lines of [withTables, withoutTables]) {
      expect(lines.some((l) => l.includes('Keybindings'))).toBe(true)
      expect(lines.some((l) => l.includes('<CR>'))).toBe(true)
      expect(lines.some((l) => l.includes('q'))).toBe(true)
      expect(lines.some((l) => l.includes('a'))).toBe(true)
    }
  })
})

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
