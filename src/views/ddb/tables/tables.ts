import type { Buffer, NvimPlugin, Window } from 'neovim'
import { listDynamoDBTables } from '../../../accessors/ddb/tables'
import {
  initializeDDBTablesCommands,
  selectDDBTable,
  refreshDDBTables,
} from './commands'
import type { ViewRegistryEntry } from '../../../types'
import { VIEW_TO_FILETYPE } from '../../../types'

export async function initializeDDBTablesView(
  plugin: NvimPlugin,
  window: Window,
  args?: string[]
): Promise<void> {
  const nvim = plugin.nvim

  // Get DynamoDB tables
  const tableNames = await listDynamoDBTables()

  // Format as a clean list (one table per line)
  const lines: string[] = tableNames || []

  // TODO: Create mapped model based on response

  // Initialize view
  const buffer = (await nvim.createBuffer(false, true)) as Buffer

  // Set buffer options
  await nvim.call('nvim_buf_set_option', [buffer, 'buftype', 'nofile'])
  await nvim.call('nvim_buf_set_option', [buffer, 'bufhidden', 'hide'])
  await nvim.call('nvim_buf_set_option', [
    buffer,
    'filetype',
    VIEW_TO_FILETYPE['dynamo_db_tables'],
  ])

  // Set content then make read-only
  await nvim.call('nvim_buf_set_lines', [buffer, 0, -1, false, lines])
  await nvim.call('nvim_buf_set_option', [buffer, 'modifiable', false])

  // Set the buffer to the window
  await nvim.call('nvim_win_set_buf', [window.id, buffer])

  // Setup keybindings for the tables view
  await initializeDDBTablesCommands(plugin, buffer)
}

/**
 * DynamoDB Tables View Registry Entry
 */
export const ddbTablesViewEntry: ViewRegistryEntry = {
  name: 'dynamo_db_tables',
  initialize: initializeDDBTablesView,
  actions: {
    select: selectDDBTable,
    refresh: refreshDDBTables,
  },
}
