import type { Buffer, NvimPlugin } from 'neovim'

/**
 * Initialize keybindings for the DDB query-results view.
 */
export async function initializeDDBQueryResultsCommands(
  plugin: NvimPlugin,
  buffer: Buffer
): Promise<void> {
  const nvim = plugin.nvim

  // q goes back to the query form via jump list
  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'q',
    '<C-o>',
    { noremap: true, silent: true, desc: 'Go back to query form' },
  ])
}
