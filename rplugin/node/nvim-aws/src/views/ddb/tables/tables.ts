import { Neovim } from 'neovim'
import { listDynamoDBTables } from '../../../accessors/ddb/tables'

export async function initializeDDBTablesView(
  nvim: Neovim,
  window: any
): Promise<void> {
  // Get DynamoDB tables
  const tableNames = await listDynamoDBTables()

  // Convert response to formatted JSON lines
  const lines: string[] = JSON.stringify(tableNames, null, 2).split('\n')

  // Create mapped model based on response

  // Create a new buffer
  const buffer = await nvim.createBuffer(false, true)

  // Make the buffer read-only
  await nvim.call('nvim_buf_set_option', [buffer, 'modifiable', false])
  await nvim.call('nvim_buf_set_option', [buffer, 'buftype', 'nofile'])
  await nvim.call('nvim_buf_set_option', [buffer, 'bufhidden', 'wipe'])

  // Set buffer content
  await nvim.call('nvim_buf_set_lines', [buffer, 0, -1, false, lines])

  // Set the buffer to the window
  await nvim.call('nvim_win_set_buf', [window, buffer])

  // Setup keybinding options
  // ctrl - open nearest table
  // a - view options for table
}
