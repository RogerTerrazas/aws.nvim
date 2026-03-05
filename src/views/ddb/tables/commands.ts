import type { Buffer, NvimPlugin } from 'neovim'
import { handleRoute } from '../../../router'

/**
 * Action: Open the AWS account/profile switcher view.
 */
export async function openAccountSwitcher(plugin: NvimPlugin): Promise<void> {
  await handleRoute(plugin, 'aws_accounts', [])
}

/**
 * Action: Select DynamoDB table on current line and route to table view
 */
export async function selectDDBTable(plugin: NvimPlugin): Promise<void> {
  const nvim = plugin.nvim
  try {
    const line = await nvim.line
    const tableName = line.trim()
    if (tableName) {
      // Route to the table view with the table name as an argument
      await handleRoute(plugin, 'dynamo_db_table', [tableName])
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
 * Action: Open query form for the DynamoDB table on the current line
 */
export async function queryDDBTable(plugin: NvimPlugin): Promise<void> {
  const nvim = plugin.nvim
  try {
    const line = await nvim.line
    const tableName = line.trim()
    if (tableName) {
      await handleRoute(plugin, 'dynamo_db_query', [tableName])
    } else {
      await nvim.command('echo "No table name on current line"')
    }
  } catch (error) {
    await nvim.errWrite(`Error opening query view: ${String(error)}\n`)
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

  // Map Enter key to select table action
  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    '<CR>',
    '<cmd>NvimAws action select<CR>',
    { noremap: true, silent: true, desc: 'Select DynamoDB table' },
  ])

  // Map q to open query form for the table on the current line
  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'q',
    '<cmd>NvimAws action query<CR>',
    { noremap: true, silent: true, desc: 'Query DynamoDB table' },
  ])

  // Map a to open the AWS profile switcher
  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'a',
    '<cmd>NvimAws action accounts<CR>',
    { noremap: true, silent: true, desc: 'Switch AWS profile' },
  ])
}
