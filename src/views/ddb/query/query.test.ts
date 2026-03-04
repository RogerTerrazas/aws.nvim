import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import {
  DynamoDBClient,
  DescribeTableCommand,
  ScalarAttributeType,
  KeyType,
} from '@aws-sdk/client-dynamodb'
import { initializeDDBQueryView } from './query'
import type { NvimPlugin, Window } from 'neovim'

const ddbMock = mockClient(DynamoDBClient)

function createMockPlugin() {
  const mockBuffer = { id: 42 }
  const mockNvim = {
    createBuffer: vi.fn().mockResolvedValue(mockBuffer),
    call: vi.fn().mockResolvedValue(undefined),
    errWrite: vi.fn().mockResolvedValue(undefined),
  }
  return { nvim: mockNvim, registerCommand: vi.fn() } as unknown as NvimPlugin
}

const tableResponse = {
  Table: {
    TableName: 'orders-table',
    KeySchema: [
      { AttributeName: 'userId', KeyType: KeyType.HASH },
      { AttributeName: 'timestamp', KeyType: KeyType.RANGE },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: ScalarAttributeType.S },
      { AttributeName: 'timestamp', AttributeType: ScalarAttributeType.N },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'status-index',
        KeySchema: [{ AttributeName: 'status', KeyType: KeyType.HASH }],
      },
    ],
    LocalSecondaryIndexes: [],
  },
}

describe('initializeDDBQueryView', () => {
  beforeEach(() => {
    ddbMock.reset()
  })

  describe('SUCCESS cases', () => {
    it('should create a modifiable buffer with form lines', async () => {
      ddbMock.on(DescribeTableCommand).resolves(tableResponse)

      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      await initializeDDBQueryView(plugin, window, ['orders-table'])

      expect(plugin.nvim.createBuffer).toHaveBeenCalledWith(false, true)

      // Buffer should NOT have modifiable set to false (it stays editable)
      const calls: Array<unknown[]> = (
        plugin.nvim.call as ReturnType<typeof vi.fn>
      ).mock.calls
      const modifiableFalseCalls = calls.filter(
        (c) =>
          c[0] === 'nvim_buf_set_option' &&
          Array.isArray(c[1]) &&
          c[1][1] === 'modifiable' &&
          c[1][2] === false
      )
      expect(modifiableFalseCalls).toHaveLength(0)
    })

    it('should set the correct filetype on the buffer', async () => {
      ddbMock.on(DescribeTableCommand).resolves(tableResponse)

      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      await initializeDDBQueryView(plugin, window, ['orders-table'])

      const calls: Array<unknown[]> = (
        plugin.nvim.call as ReturnType<typeof vi.fn>
      ).mock.calls
      const filetypeCall = calls.find(
        (c) =>
          c[0] === 'nvim_buf_set_option' &&
          Array.isArray(c[1]) &&
          c[1][1] === 'filetype' &&
          c[1][2] === 'nvim-aws-ddb-query'
      )
      expect(filetypeCall).toBeDefined()
    })

    it('should include the table name and available indexes in buffer lines', async () => {
      ddbMock.on(DescribeTableCommand).resolves(tableResponse)

      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      await initializeDDBQueryView(plugin, window, ['orders-table'])

      const calls: Array<unknown[]> = (
        plugin.nvim.call as ReturnType<typeof vi.fn>
      ).mock.calls
      const setLinesCall = calls.find((c) => c[0] === 'nvim_buf_set_lines')

      expect(setLinesCall).toBeDefined()
      const lines = (
        setLinesCall as [string, [unknown, number, number, boolean, string[]]]
      )[1][4]

      expect(lines.some((l) => l.includes('orders-table'))).toBe(true)
      expect(lines.some((l) => l.includes('userId'))).toBe(true)
      expect(lines.some((l) => l.includes('status-index'))).toBe(true)
    })

    it('should set the buffer on the window', async () => {
      ddbMock.on(DescribeTableCommand).resolves(tableResponse)

      const plugin = createMockPlugin()
      const window = { id: 7 } as unknown as Window

      await initializeDDBQueryView(plugin, window, ['orders-table'])

      const calls: Array<unknown[]> = (
        plugin.nvim.call as ReturnType<typeof vi.fn>
      ).mock.calls
      const winSetBufCall = calls.find((c) => c[0] === 'nvim_win_set_buf')
      expect(winSetBufCall).toBeDefined()
      expect((winSetBufCall as [string, [number]])[1][0]).toBe(7)
    })
  })

  describe('FAILURE cases', () => {
    it('should write error when no table name is provided', async () => {
      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      await initializeDDBQueryView(plugin, window, [])

      expect(plugin.nvim.errWrite).toHaveBeenCalledWith(
        expect.stringContaining('Table name is required')
      )
    })

    it('should write error when DescribeTable fails', async () => {
      ddbMock
        .on(DescribeTableCommand)
        .rejects(new Error('ResourceNotFoundException'))

      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      await initializeDDBQueryView(plugin, window, ['ghost-table'])

      expect(plugin.nvim.errWrite).toHaveBeenCalledWith(
        expect.stringContaining('Error loading table schema')
      )
    })
  })
})
