import type { Buffer, NvimPlugin } from 'neovim'

/**
 * Action: Select DynamoDB table on current line
 */
export async function selectDDBTable(plugin: NvimPlugin): Promise<void> {
  const nvim = plugin.nvim
  try {
    const line = await nvim.line
    const tableName = line.trim()
    if (tableName) {
      // Show visual feedback using echo (visible in command line)
      await nvim.command(`echo "Selected DynamoDB table: ${tableName}"`)
      // Also write to output for logging
      await nvim.outWrite(`Selected table: ${tableName}\n`)
    } else {
      await nvim.command('echo "No table name on current line"')
    }
  } catch (error) {
    await nvim.errWrite(`Error selecting table: ${String(error)}\n`)
    await nvim.command(
      `echohl ErrorMsg | echo "Error: ${String(error)}" | echohl None`
    )
  }
}

/**
 * Action: Refresh DynamoDB tables list
 */
export async function refreshDDBTables(plugin: NvimPlugin): Promise<void> {
  const nvim = plugin.nvim
  try {
    await nvim.command('echo "Refreshing DynamoDB tables..."')
    // Future: Implement refresh logic
    await nvim.command('echo "Refresh not yet implemented"')
  } catch (error) {
    await nvim.errWrite(`Error refreshing tables: ${String(error)}\n`)
  }
}

/**
 * Initialize keybindings for DDB tables view
 */
export async function initializeDDBTablesCommands(
  plugin: NvimPlugin,
  buffer: Buffer
): Promise<void> {
  const nvim = plugin.nvim

  // Map Ctrl+Enter key to select table action
  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    '<C-CR>',
    '<cmd>NvimAws action select<CR>',
    { noremap: true, silent: true, desc: 'Select DynamoDB table' },
  ])

  // Map 'r' key to refresh action
  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'r',
    '<cmd>NvimAws action refresh<CR>',
    { noremap: true, silent: true, desc: 'Refresh tables list' },
  ])
}
