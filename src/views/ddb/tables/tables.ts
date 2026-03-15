import type { Buffer, NvimPlugin, Window } from 'neovim'
import { listDynamoDBTables } from '../../../accessors/ddb/tables'
import { getBufferTitle } from '../../../session/index'
import type { ViewRegistryEntry } from '../../../types'
import { VIEW_TO_FILETYPE } from '../../../types'
import { logger } from '../../../utils/logger'
import {
  initializeDDBTablesCommands,
  openAccountSwitcher,
  queryDDBTable,
  selectDDBTable,
} from './commands'

export async function initializeDDBTablesView(
  plugin: NvimPlugin,
  window: Window,
  _args?: string[]
): Promise<void> {
  const nvim = plugin.nvim

  // Get DynamoDB tables
  const tableNames = await listDynamoDBTables()

  // Format as a clean list (one table per line)
  const lines: string[] = tableNames || []

  if (lines.length === 0) {
    logger.warn('initializeDDBTablesView: no tables returned from AWS', {})
  } else {
    logger.debug('initializeDDBTablesView: tables fetched', {
      tableCount: lines.length,
    })
  }

  // TODO: Create mapped model based on response

  // Initialize view
  const buffer = (await nvim.createBuffer(true, true)) as Buffer

  // Set buffer options
  await nvim.call('nvim_buf_set_option', [buffer, 'buftype', 'nofile'])
  await nvim.call('nvim_buf_set_option', [buffer, 'bufhidden', 'hide'])
  await nvim.call('nvim_buf_set_option', [
    buffer,
    'filetype',
    VIEW_TO_FILETYPE.dynamo_db_tables,
  ])

  // Set content then make read-only
  await nvim.call('nvim_buf_set_lines', [buffer, 0, -1, false, lines])
  await nvim.call('nvim_buf_set_option', [buffer, 'modifiable', false])

  // Set buffer name with profile context
  const bufferTitle = getBufferTitle('DynamoDB Tables')
  await nvim.call('nvim_buf_set_name', [buffer, bufferTitle])

  // Set the buffer to the window
  logger.debug('initializeDDBTablesView: setting buffer in window', {
    bufnr: buffer.id,
    windowId: window.id,
    bufferTitle,
  })
  await nvim.call('nvim_win_set_buf', [window.id, buffer])
  logger.info('initializeDDBTablesView: buffer set in window', {
    bufnr: buffer.id,
    lineCount: lines.length,
  })

  // Setup keybindings for the tables view
  await initializeDDBTablesCommands(plugin, buffer)
}

/**
 * DynamoDB Tables View Registry Entry
 */
export const ddbTablesViewEntry: ViewRegistryEntry = {
  name: 'dynamo_db_tables',
  bufferLabel: 'DynamoDB Tables',
  initialize: initializeDDBTablesView,
  actions: {
    select: selectDDBTable,
    query: queryDDBTable,
    accounts: openAccountSwitcher,
  },
}
