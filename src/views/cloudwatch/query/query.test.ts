import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
} from '@aws-sdk/client-cloudwatch-logs'
import { initializeCWQueryView, buildQueryFormLines } from './query.js'
import type { NvimPlugin, Window } from 'neovim'

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

describe('buildQueryFormLines', () => {
  it('should include the query fields section at the top', () => {
    const lines = buildQueryFormLines([])

    expect(lines[0]).toMatch(/Time Mode/)
    expect(lines[1]).toMatch(/Time:/)
    expect(lines[2]).toMatch(/Limit:/)
    expect(lines[3]).toMatch(/Query:/)
  })

  it('should include the default query template', () => {
    const lines = buildQueryFormLines([])
    expect(lines.some((l) => l.includes('filter @message like //'))).toBe(true)
  })

  it('should include log group separator', () => {
    const lines = buildQueryFormLines([])
    expect(lines.some((l) => l.includes('── Log Groups'))).toBe(true)
  })

  it('should list log groups as commented-out lines', () => {
    const logGroups = [
      { logGroupName: '/aws/lambda/fn-1' },
      { logGroupName: '/aws/lambda/fn-2' },
    ]
    const lines = buildQueryFormLines(logGroups)

    expect(lines.some((l) => l === '# /aws/lambda/fn-1')).toBe(true)
    expect(lines.some((l) => l === '# /aws/lambda/fn-2')).toBe(true)
  })

  it('should show placeholder message when no log groups exist', () => {
    const lines = buildQueryFormLines([])
    expect(lines.some((l) => l.includes('no log groups found'))).toBe(true)
  })

  it('should include the docs section at the bottom', () => {
    const lines = buildQueryFormLines([])
    expect(lines.some((l) => l.includes('── Docs'))).toBe(true)
    expect(lines.some((l) => l.includes('relative'))).toBe(true)
    expect(lines.some((l) => l.includes('absolute'))).toBe(true)
  })
})

describe('initializeCWQueryView', () => {
  beforeEach(() => {
    cwMock.reset()
  })

  describe('SUCCESS cases', () => {
    it('should create a modifiable buffer with form lines', async () => {
      cwMock.on(DescribeLogGroupsCommand).resolves({
        logGroups: [{ logGroupName: '/aws/lambda/my-fn' }],
      })

      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      await initializeCWQueryView(plugin, window)

      expect(plugin.nvim.createBuffer).toHaveBeenCalledWith(false, true)

      // Buffer must NOT have modifiable set to false (user needs to edit it)
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

    it('should set the correct filetype', async () => {
      cwMock.on(DescribeLogGroupsCommand).resolves({ logGroups: [] })

      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      await initializeCWQueryView(plugin, window)

      const calls: Array<unknown[]> = (
        plugin.nvim.call as ReturnType<typeof vi.fn>
      ).mock.calls
      const filetypeCall = calls.find(
        (c) =>
          c[0] === 'nvim_buf_set_option' &&
          Array.isArray(c[1]) &&
          c[1][1] === 'filetype' &&
          c[1][2] === 'nvim-aws-cw-query'
      )
      expect(filetypeCall).toBeDefined()
    })

    it('should include log group names in the buffer', async () => {
      cwMock.on(DescribeLogGroupsCommand).resolves({
        logGroups: [
          { logGroupName: '/aws/lambda/fn-1' },
          { logGroupName: '/ecs/my-service' },
        ],
      })

      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      await initializeCWQueryView(plugin, window)

      const calls: Array<unknown[]> = (
        plugin.nvim.call as ReturnType<typeof vi.fn>
      ).mock.calls
      const setLinesCall = calls.find((c) => c[0] === 'nvim_buf_set_lines')

      expect(setLinesCall).toBeDefined()
      const lines = (
        setLinesCall as [string, [unknown, number, number, boolean, string[]]]
      )[1][4]

      expect(lines.some((l) => l.includes('/aws/lambda/fn-1'))).toBe(true)
      expect(lines.some((l) => l.includes('/ecs/my-service'))).toBe(true)
    })

    it('should set the buffer on the window', async () => {
      cwMock.on(DescribeLogGroupsCommand).resolves({ logGroups: [] })

      const plugin = createMockPlugin()
      const window = { id: 7 } as unknown as Window

      await initializeCWQueryView(plugin, window)

      const calls: Array<unknown[]> = (
        plugin.nvim.call as ReturnType<typeof vi.fn>
      ).mock.calls
      const winSetBufCall = calls.find((c) => c[0] === 'nvim_win_set_buf')
      expect(winSetBufCall).toBeDefined()
      expect((winSetBufCall as [string, [number]])[1][0]).toBe(7)
    })
  })

  describe('FAILURE cases', () => {
    it('should write error when listLogGroups fails', async () => {
      cwMock
        .on(DescribeLogGroupsCommand)
        .rejects(new Error('AccessDeniedException'))

      const plugin = createMockPlugin()
      const window = { id: 1 } as unknown as Window

      await initializeCWQueryView(plugin, window)

      expect(plugin.nvim.errWrite).toHaveBeenCalledWith(
        expect.stringContaining('Error loading CloudWatch log groups')
      )
    })
  })
})
