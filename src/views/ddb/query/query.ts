import type { Buffer, NvimPlugin, Window } from 'neovim'
import { describeTable } from '../../../accessors/ddb/describe-table'
import type {
  TableDescription,
  TableIndex,
} from '../../../accessors/ddb/describe-table'
import { initializeDDBQueryCommands, submitDDBQuery } from './commands'
import type { ViewRegistryEntry } from '../../../types'
import { VIEW_TO_FILETYPE } from '../../../types'

// Module-level state: current table description used by submit action
let currentTableDescription: TableDescription | null = null

export function getTableDescription(): TableDescription | null {
  return currentTableDescription
}

function buildIndexLabel(index: TableIndex): string {
  const sk = index.keySchema.sortKey
    ? `, SK: ${index.keySchema.sortKey.name} [${index.keySchema.sortKey.type}]`
    : ''
  return `${index.name} (PK: ${index.keySchema.partitionKey.name} [${index.keySchema.partitionKey.type}]${sk})`
}

function buildFormLines(tableDesc: TableDescription): string[] {
  const { keySchema, globalSecondaryIndexes, localSecondaryIndexes } = tableDesc
  const allIndexes = [...globalSecondaryIndexes, ...localSecondaryIndexes]

  const primaryPkLabel = `${keySchema.partitionKey.name} [${keySchema.partitionKey.type}]`
  const primarySkLabel = keySchema.sortKey
    ? `${keySchema.sortKey.name} [${keySchema.sortKey.type}]`
    : '(none)'

  const lines: string[] = [
    `Table:  ${tableDesc.tableName}`,
    `Index:  (primary)`,
    `PK (${primaryPkLabel}): `,
    `SK (${primarySkLabel}): `,
    `Limit:  50`,
    ``,
  ]

  lines.push(`# Indexes:`)
  lines.push(`#   (primary) — PK: ${primaryPkLabel}, SK: ${primarySkLabel}`)
  for (const idx of allIndexes) {
    lines.push(`#   ${buildIndexLabel(idx)}`)
  }
  lines.push(`#`)
  lines.push(`# Press <CR> on any line to execute query. Press q to go back.`)

  return lines
}

export async function initializeDDBQueryView(
  plugin: NvimPlugin,
  window: Window,
  args?: string[]
): Promise<void> {
  const nvim = plugin.nvim

  if (!args || args.length === 0) {
    await nvim.errWrite('Table name is required for query view\n')
    return
  }

  const tableName = args[0]!

  try {
    const tableDesc = await describeTable(tableName)
    currentTableDescription = tableDesc

    const lines = buildFormLines(tableDesc)

    const buffer = (await nvim.createBuffer(false, true)) as Buffer

    await nvim.call('nvim_buf_set_option', [buffer, 'buftype', 'nofile'])
    await nvim.call('nvim_buf_set_option', [buffer, 'bufhidden', 'hide'])
    await nvim.call('nvim_buf_set_option', [
      buffer,
      'filetype',
      VIEW_TO_FILETYPE['dynamo_db_query'],
    ])

    // Set content — leave modifiable so user can edit field values
    await nvim.call('nvim_buf_set_lines', [buffer, 0, -1, false, lines])

    await nvim.call('nvim_win_set_buf', [window.id, buffer])

    await initializeDDBQueryCommands(plugin, buffer)
  } catch (error) {
    await nvim.errWrite(
      `Error loading table schema for ${tableName}: ${String(error)}\n`
    )
  }
}

export const ddbQueryViewEntry: ViewRegistryEntry = {
  name: 'dynamo_db_query',
  initialize: initializeDDBQueryView,
  actions: {
    submit: submitDDBQuery,
  },
}
