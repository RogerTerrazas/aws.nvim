import type { Buffer, NvimPlugin } from 'neovim'

/**
 * Initialize keybindings for DDB table view
 */
export async function initializeDDBTableCommands(
  plugin: NvimPlugin,
  buffer: Buffer
): Promise<void> {
  const nvim = plugin.nvim

  // Map 'q' key to close the tab
  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'q',
    '<cmd>tabclose<CR>',
    { noremap: true, silent: true, desc: 'Close table view' },
  ])

  // Map 'r' key to refresh action (future implementation)
  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'r',
    '<cmd>NvimAws action refresh<CR>',
    { noremap: true, silent: true, desc: 'Refresh table items' },
  ])
}
