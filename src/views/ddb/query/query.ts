import type { Buffer, NvimPlugin, Window } from 'neovim'
import type {
  TableDescription,
  TableIndex,
} from '../../../accessors/ddb/describe-table'
import { describeTable } from '../../../accessors/ddb/describe-table'
import { getBufferTitle } from '../../../session/index'
import type { ViewRegistryEntry } from '../../../types'
import { VIEW_TO_FILETYPE } from '../../../types'
import { logger } from '../../../utils/logger'
import { initializeDDBQueryCommands, submitDDBQuery } from './commands'

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
    `Filter: `,
    `Limit:  50`,
    ``,
  ]

  lines.push(`# Indexes:`)
  lines.push(`#   (primary) — PK: ${primaryPkLabel}, SK: ${primarySkLabel}`)
  for (const idx of allIndexes) {
    lines.push(`#   ${buildIndexLabel(idx)}`)
  }
  lines.push(`#`)
  lines.push(
    `# SK operators: = > >= < <=  |  begins_with <val>  |  between <v1> AND <v2>`
  )
  lines.push(
    `# Examples:  "> 1000"   "begins_with ORDER"   "between 10 AND 20"`
  )
  lines.push(`# Values may contain spaces: "= my file.pdf"   "between a AND z"`)
  lines.push(`#`)
  lines.push(`# Filter: <attr> <op> <value>  — applied after key lookup`)
  lines.push(
    `# Filter examples:  "status = ACTIVE"  "price > 100"  "name begins_with Jo"`
  )
  lines.push(
    `# If PK is empty and Filter is set, a Scan is used instead of Query.`
  )
  lines.push(`# Press <CR> on any line to execute. Press q to go back.`)

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

  const tableName = args[0] ?? ''

  logger.info('initializeDDBQueryView: start', { tableName })

  try {
    const tableDesc = await describeTable(tableName)
    currentTableDescription = tableDesc

    logger.debug('initializeDDBQueryView: table described', { tableName })

    const lines = buildFormLines(tableDesc)

    const buffer = (await nvim.createBuffer(true, true)) as Buffer

    await nvim.call('nvim_buf_set_option', [buffer, 'buftype', 'nofile'])
    await nvim.call('nvim_buf_set_option', [buffer, 'bufhidden', 'hide'])
    await nvim.call('nvim_buf_set_option', [
      buffer,
      'filetype',
      VIEW_TO_FILETYPE.dynamo_db_query,
    ])

    // Set content — leave modifiable so user can edit field values
    await nvim.call('nvim_buf_set_lines', [buffer, 0, -1, false, lines])

    // Set buffer name with profile context
    const bufferTitle = getBufferTitle(`DynamoDB Query: ${tableName}`)
    await nvim.call('nvim_buf_set_name', [buffer, bufferTitle])

    logger.debug('initializeDDBQueryView: setting buffer in window', {
      bufnr: buffer.id,
      windowId: window.id,
      bufferTitle,
    })
    await nvim.call('nvim_win_set_buf', [window.id, buffer])
    logger.info('initializeDDBQueryView: buffer set in window', {
      bufnr: buffer.id,
      lineCount: lines.length,
    })

    await initializeDDBQueryCommands(plugin, buffer)
  } catch (error) {
    logger.error('initializeDDBQueryView: caught error', {
      tableName,
      error: String(error),
    })
    await nvim.errWrite(
      `Error loading table schema for ${tableName}: ${String(error)}\n`
    )
  }
}

export const ddbQueryViewEntry: ViewRegistryEntry = {
  name: 'dynamo_db_query',
  bufferLabel: (tableName: string) => `DynamoDB Query: ${tableName}`,
  initialize: initializeDDBQueryView,
  actions: {
    submit: submitDDBQuery,
  },
}
