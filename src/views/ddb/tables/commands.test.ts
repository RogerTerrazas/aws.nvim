import { describe, it, expect, vi } from 'vitest'
import { initializeDDBTablesCommands } from './commands'
import type { Buffer, NvimPlugin } from 'neovim'

function createMockPlugin() {
  const mockNvim = {
    call: vi.fn().mockResolvedValue(undefined),
  }

  return {
    nvim: mockNvim,
    registerCommand: vi.fn(),
  } as unknown as NvimPlugin
}

function createMockBuffer() {
  return { id: 1 } as unknown as Buffer
}

describe('initializeDDBTablesCommands', () => {
  it('should set up Enter keymap for select action', async () => {
    const mockPlugin = createMockPlugin()
    const mockBuffer = createMockBuffer()

    await initializeDDBTablesCommands(mockPlugin, mockBuffer)

    expect(mockPlugin.nvim.call).toHaveBeenCalledWith('nvim_buf_set_keymap', [
      mockBuffer,
      'n',
      '<CR>',
      '<cmd>NvimAws action select<CR>',
      expect.objectContaining({
        noremap: true,
        silent: true,
        desc: 'Select DynamoDB table',
      }),
    ])
  })

  it('should set up q keymap for query action', async () => {
    const mockPlugin = createMockPlugin()
    const mockBuffer = createMockBuffer()

    await initializeDDBTablesCommands(mockPlugin, mockBuffer)

    expect(mockPlugin.nvim.call).toHaveBeenCalledWith('nvim_buf_set_keymap', [
      mockBuffer,
      'n',
      'q',
      '<cmd>NvimAws action query<CR>',
      expect.objectContaining({
        noremap: true,
        silent: true,
        desc: 'Query DynamoDB table',
      }),
    ])
  })
})
