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

// ─── Layout helpers ──────────────────────────────────────────────────────────

/**
 * Build the full set of lines for the DDB tables buffer.
 *
 * Layout:
 *   <table names — one per line>
 *
 *   <keybinding legend>
 */
export function buildDDBTablesLines(tableNames: string[]): string[] {
  const lines: string[] = []

  // ── Table list ────────────────────────────────────────────────────────────
  if (tableNames.length === 0) {
    lines.push('  (no tables found in this account/region)')
  } else {
    for (const name of tableNames) {
      lines.push(name)
    }
  }
  lines.push('')

  // ── Keybinding legend ─────────────────────────────────────────────────────
  lines.push('  Keybindings')
  lines.push('  ──────────────────────────────────────')
  lines.push('  <CR>  →  Scan table under cursor (first 50 items)')
  lines.push('  q     →  Open query form for table under cursor')
  lines.push('  a     →  Switch AWS profile')

  return lines
}

// ─── View initializer ────────────────────────────────────────────────────────

export async function initializeDDBTablesView(
  plugin: NvimPlugin,
  window: Window,
  _args?: string[]
): Promise<void> {
  const nvim = plugin.nvim

  // Get DynamoDB tables
  const tableNames = await listDynamoDBTables()

  if (!tableNames || tableNames.length === 0) {
    logger.warn('initializeDDBTablesView: no tables returned from AWS', {})
  } else {
    logger.debug('initializeDDBTablesView: tables fetched', {
      tableCount: tableNames.length,
    })
  }

  const lines = buildDDBTablesLines(tableNames ?? [])

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
