import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  QueryStatus,
  StartQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs'
import { mockClient } from 'aws-sdk-client-mock'
import type { NvimPlugin, Window } from 'neovim'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeCWQueryResultsView } from './query-results.js'

vi.useFakeTimers()

const cwMock = mockClient(CloudWatchLogsClient)

function createMockPlugin() {
  const mockBuffer = { id: 42 }
  const mockNvim = {
    createBuffer: vi.fn().mockResolvedValue(mockBuffer),
    call: vi.fn().mockResolvedValue(undefined),
    errWrite: vi.fn().mockResolvedValue(undefined),
    outWrite: vi.fn().mockResolvedValue(undefined),
  }
  return { nvim: mockNvim, registerCommand: vi.fn() } as unknown as NvimPlugin
}

const BASE_ARGS = [
  JSON.stringify(['/aws/lambda/my-fn']),
  'filter @message like //',
  '1700000000',
  '1700003600',
  '100',
]

describe('initializeCWQueryResultsView', () => {
  beforeEach(() => {
    cwMock.reset()
    vi.clearAllTimers()
  })

  describe('SUCCESS cases', () => {
    it('should create a buffer and show placeholder while querying', async () => {
      cwMock.on(StartQueryCommand).resolves({ queryId: 'q-1' })
      cwMock.on(GetQueryResultsCommand).resolves({
        status: QueryStatus.Complete,
        results: [],
        statistics: {},
      })

      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      const promise = initializeCWQueryResultsView(plugin, window, BASE_ARGS)
      await vi.runAllTimersAsync()
      await promise

      expect(plugin.nvim.createBuffer).toHaveBeenCalledWith(true, true)

      const calls: Array<unknown[]> = (
        plugin.nvim.call as ReturnType<typeof vi.fn>
      ).mock.calls

      // First nvim_buf_set_lines should be the placeholder
      const setLinesCalls = calls.filter((c) => c[0] === 'nvim_buf_set_lines')
      expect(setLinesCalls.length).toBeGreaterThanOrEqual(2)

      const firstLines = (
        setLinesCalls[0] as [
          string,
          [unknown, number, number, boolean, string[]],
        ]
      )[1][4]
      expect(firstLines[0]).toContain('Running')
    })

    it('should set the correct filetype', async () => {
      cwMock.on(StartQueryCommand).resolves({ queryId: 'q-1' })
      cwMock.on(GetQueryResultsCommand).resolves({
        status: QueryStatus.Complete,
        results: [],
        statistics: {},
      })

      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      const promise = initializeCWQueryResultsView(plugin, window, BASE_ARGS)
      await vi.runAllTimersAsync()
      await promise

      const calls: Array<unknown[]> = (
        plugin.nvim.call as ReturnType<typeof vi.fn>
      ).mock.calls
      const filetypeCall = calls.find(
        (c) =>
          c[0] === 'nvim_buf_set_option' &&
          Array.isArray(c[1]) &&
          c[1][1] === 'filetype' &&
          c[1][2] === 'nvim-aws-cw-query-results'
      )
      expect(filetypeCall).toBeDefined()
    })

    it('should render results as field-per-line with blank separators', async () => {
      cwMock.on(StartQueryCommand).resolves({ queryId: 'q-1' })
      cwMock.on(GetQueryResultsCommand).resolves({
        status: QueryStatus.Complete,
        results: [
          [
            { field: '@timestamp', value: '2024-01-15 10:00:00.000' },
            { field: '@message', value: 'Hello world' },
          ],
          [
            { field: '@timestamp', value: '2024-01-15 11:00:00.000' },
            { field: '@message', value: 'Another event' },
          ],
        ],
        statistics: { recordsMatched: 2, recordsScanned: 1000 },
      })

      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      const promise = initializeCWQueryResultsView(plugin, window, BASE_ARGS)
      await vi.runAllTimersAsync()
      await promise

      const calls: Array<unknown[]> = (
        plugin.nvim.call as ReturnType<typeof vi.fn>
      ).mock.calls
      const setLinesCalls = calls.filter((c) => c[0] === 'nvim_buf_set_lines')
      // Last set-lines call is the final content
      const finalLines = (
        setLinesCalls[setLinesCalls.length - 1] as [
          string,
          [unknown, number, number, boolean, string[]],
        ]
      )[1][4]

      expect(finalLines.some((l) => l.includes('@timestamp'))).toBe(true)
      expect(finalLines.some((l) => l.includes('Hello world'))).toBe(true)
      expect(finalLines.some((l) => l.includes('Another event'))).toBe(true)
      // Should have a blank line separator between events
      expect(finalLines.includes('')).toBe(true)
    })

    it('should show (no results) when query returns empty results', async () => {
      cwMock.on(StartQueryCommand).resolves({ queryId: 'q-1' })
      cwMock.on(GetQueryResultsCommand).resolves({
        status: QueryStatus.Complete,
        results: [],
        statistics: {},
      })

      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      const promise = initializeCWQueryResultsView(plugin, window, BASE_ARGS)
      await vi.runAllTimersAsync()
      await promise

      const calls: Array<unknown[]> = (
        plugin.nvim.call as ReturnType<typeof vi.fn>
      ).mock.calls
      const setLinesCalls = calls.filter((c) => c[0] === 'nvim_buf_set_lines')
      const finalLines = (
        setLinesCalls[setLinesCalls.length - 1] as [
          string,
          [unknown, number, number, boolean, string[]],
        ]
      )[1][4]

      expect(finalLines.some((l) => l.includes('no results'))).toBe(true)
    })

    it('should lock the buffer as read-only after results are loaded', async () => {
      cwMock.on(StartQueryCommand).resolves({ queryId: 'q-1' })
      cwMock.on(GetQueryResultsCommand).resolves({
        status: QueryStatus.Complete,
        results: [],
        statistics: {},
      })

      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      const promise = initializeCWQueryResultsView(plugin, window, BASE_ARGS)
      await vi.runAllTimersAsync()
      await promise

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
      expect(modifiableFalseCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('should set the buffer on the window', async () => {
      cwMock.on(StartQueryCommand).resolves({ queryId: 'q-1' })
      cwMock.on(GetQueryResultsCommand).resolves({
        status: QueryStatus.Complete,
        results: [],
        statistics: {},
      })

      const plugin = createMockPlugin()
      const window = { id: 9 } as unknown as Window

      const promise = initializeCWQueryResultsView(plugin, window, BASE_ARGS)
      await vi.runAllTimersAsync()
      await promise

      const calls: Array<unknown[]> = (
        plugin.nvim.call as ReturnType<typeof vi.fn>
      ).mock.calls
      const winSetBufCall = calls.find((c) => c[0] === 'nvim_win_set_buf')
      expect(winSetBufCall).toBeDefined()
      expect((winSetBufCall as [string, [number]])[1][0]).toBe(9)
    })
  })

  describe('FAILURE cases', () => {
    it('should write error message to buffer when query fails', async () => {
      cwMock
        .on(StartQueryCommand)
        .rejects(new Error('InvalidParameterException'))

      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      const promise = initializeCWQueryResultsView(plugin, window, BASE_ARGS)
      await vi.runAllTimersAsync()
      await promise

      const calls: Array<unknown[]> = (
        plugin.nvim.call as ReturnType<typeof vi.fn>
      ).mock.calls
      const setLinesCalls = calls.filter((c) => c[0] === 'nvim_buf_set_lines')
      const finalLines = (
        setLinesCalls[setLinesCalls.length - 1] as [
          string,
          [unknown, number, number, boolean, string[]],
        ]
      )[1][4]

      expect(finalLines.some((l) => l.toLowerCase().includes('error'))).toBe(
        true
      )
      expect(
        finalLines.some((l) => l.includes('InvalidParameterException'))
      ).toBe(true)
    })

    it('should write error when args are missing', async () => {
      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      await initializeCWQueryResultsView(plugin, window, [])

      expect(plugin.nvim.errWrite).toHaveBeenCalledWith(
        expect.stringContaining('query parameters')
      )
    })

    it('should write error when log groups JSON is invalid', async () => {
      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      await initializeCWQueryResultsView(plugin, window, [
        'not-valid-json',
        'query',
        '1700000000',
        '1700003600',
        '100',
      ])

      expect(plugin.nvim.errWrite).toHaveBeenCalledWith(
        expect.stringContaining('parse log group names')
      )
    })
  })
})
