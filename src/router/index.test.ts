import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseCommand, router, viewRegistry } from './index'
import type { NvimPlugin } from 'neovim'
import type { ViewRegistryEntry } from '../types'

describe('Router', () => {
  describe('parseCommand', () => {
    it('should parse route command correctly', () => {
      const result = parseCommand(['route', 'dynamo_db_tables'])
      expect(result).toEqual({
        type: 'route',
        target: 'dynamo_db_tables',
        additionalArgs: [],
      })
    })

    it('should parse action command correctly', () => {
      const result = parseCommand(['action', 'select'])
      expect(result).toEqual({
        type: 'action',
        target: 'select',
        additionalArgs: [],
      })
    })

    it('should parse command with additional args', () => {
      const result = parseCommand(['route', 'dynamo_db_tables', 'arg1', 'arg2'])
      expect(result).toEqual({
        type: 'route',
        target: 'dynamo_db_tables',
        additionalArgs: ['arg1', 'arg2'],
      })
    })

    it('should return null for empty args', () => {
      const result = parseCommand([])
      expect(result).toEqual({
        type: null,
        target: null,
        additionalArgs: [],
      })
    })

    it('should return null for invalid command type', () => {
      const result = parseCommand(['invalid', 'target'])
      expect(result).toEqual({
        type: null,
        target: null,
        additionalArgs: [],
      })
    })

    it('should handle command type without target', () => {
      const result = parseCommand(['route'])
      expect(result).toEqual({
        type: 'route',
        target: null,
        additionalArgs: [],
      })
    })
  })

  describe('router default behavior', () => {
    let mockPlugin: NvimPlugin
    let mockInitialize: any

    beforeEach(() => {
      mockInitialize = vi.fn().mockResolvedValue(undefined)

      const mockNvim = {
        command: vi.fn().mockResolvedValue(undefined),
        window: Promise.resolve({ id: 1 }),
        errWrite: vi.fn().mockResolvedValue(undefined),
      }

      mockPlugin = {
        nvim: mockNvim,
      } as unknown as NvimPlugin

      // Register a test view for the default landing target
      const testView: ViewRegistryEntry = {
        name: 'aws_home',
        initialize: mockInitialize as any,
        actions: {},
      }
      viewRegistry.register(testView)
    })

    it('should route to aws_home by default when no args provided', async () => {
      await router(mockPlugin, [])

      expect(mockInitialize).toHaveBeenCalledWith(mockPlugin, { id: 1 }, [])
    })
  })
})
