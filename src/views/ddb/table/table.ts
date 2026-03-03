import type { Buffer, NvimPlugin, Window } from 'neovim'
import { scanDynamoDBTable } from '../../../accessors/ddb/items'
import { initializeDDBTableCommands } from './commands'
import type { ViewRegistryEntry } from '../../../types'

/**
 * Store the current table name for the view
 */
let currentTableName: string | null = null

export function getCurrentTableName(): string | null {
  return currentTableName
}

export async function initializeDDBTableView(
  plugin: NvimPlugin,
  window: Window,
  args?: string[]
): Promise<void> {
  const nvim = plugin.nvim

  // Get table name from args
  if (!args || args.length === 0) {
    await nvim.errWrite('Table name is required\n')
    return
  }

  const tableName = args[0] || ''
  if (!tableName) {
    await nvim.errWrite('Table name cannot be empty\n')
    return
  }

  currentTableName = tableName

  try {
    // Scan the table for first 50 items
    const items = await scanDynamoDBTable(tableName, 50)

    // Format items as JSON lines
    const lines: string[] = []

    // Add header
    lines.push(`DynamoDB Table: ${tableName}`)
    lines.push(`Items: ${items.length}`)
    lines.push('='.repeat(80))
    lines.push('')

    // Add items as formatted JSON
    if (items.length === 0) {
      lines.push('No items found in table')
    } else {
      items.forEach((item, index) => {
        lines.push(`Item ${index + 1}:`)
        lines.push(JSON.stringify(item, null, 2))
        lines.push('-'.repeat(80))
      })
    }

    // Initialize view
    const buffer = (await nvim.createBuffer(false, true)) as Buffer

    // Set buffer options
    await nvim.call('nvim_buf_set_option', [buffer, 'buftype', 'nofile'])
    await nvim.call('nvim_buf_set_option', [buffer, 'bufhidden', 'hide'])
    await nvim.call('nvim_buf_set_option', [
      buffer,
      'filetype',
      'nvim-aws-ddb-table',
    ])

    // Set content then make read-only
    await nvim.call('nvim_buf_set_lines', [buffer, 0, -1, false, lines])
    await nvim.call('nvim_buf_set_option', [buffer, 'modifiable', false])

    // Set the buffer to the window
    await nvim.call('nvim_win_set_buf', [window.id, buffer])

    // Setup keybindings for the table view
    await initializeDDBTableCommands(plugin, buffer)
  } catch (error) {
    await nvim.errWrite(`Error loading table ${tableName}: ${String(error)}\n`)
  }
}

/**
 * DynamoDB Table View Registry Entry
 */
export const ddbTableViewEntry: ViewRegistryEntry = {
  name: 'dynamo_db_table',
  initialize: initializeDDBTableView,
  actions: {
    // Future actions can be added here (e.g., refresh, filter, etc.)
  },
}
