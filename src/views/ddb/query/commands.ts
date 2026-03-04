import type { Buffer, NvimPlugin } from 'neovim'
import { handleRoute } from '../../../router'
import { getTableDescription } from './query'
import type {
  TableDescription,
  TableIndex,
} from '../../../accessors/ddb/describe-table'

/**
 * Parse a form line of the shape "Label (detail): value" and return the value.
 * Falls back to splitting on the first ": " if the parenthesised label pattern
 * is not present.
 */
function parseFieldValue(line: string): string {
  const colonIdx = line.indexOf(': ')
  if (colonIdx === -1) return ''
  return line.slice(colonIdx + 2).trim()
}

/**
 * Given a table description and the index name the user entered, resolve the
 * key schema for that index (partition key name/type and optional sort key).
 */
function resolveIndexSchema(
  tableDesc: TableDescription,
  indexValue: string
): {
  pkName: string
  pkType: string
  skName: string | undefined
  skType: string | undefined
} {
  const normalized = indexValue.trim().toLowerCase()

  if (!normalized || normalized === '(primary)' || normalized === 'primary') {
    return {
      pkName: tableDesc.keySchema.partitionKey.name,
      pkType: tableDesc.keySchema.partitionKey.type,
      skName: tableDesc.keySchema.sortKey?.name,
      skType: tableDesc.keySchema.sortKey?.type,
    }
  }

  const allIndexes: TableIndex[] = [
    ...tableDesc.globalSecondaryIndexes,
    ...tableDesc.localSecondaryIndexes,
  ]

  const match = allIndexes.find((i) => i.name.toLowerCase() === normalized)
  if (match) {
    return {
      pkName: match.keySchema.partitionKey.name,
      pkType: match.keySchema.partitionKey.type,
      skName: match.keySchema.sortKey?.name,
      skType: match.keySchema.sortKey?.type,
    }
  }

  // Unknown index — fall back to primary
  return {
    pkName: tableDesc.keySchema.partitionKey.name,
    pkType: tableDesc.keySchema.partitionKey.type,
    skName: tableDesc.keySchema.sortKey?.name,
    skType: tableDesc.keySchema.sortKey?.type,
  }
}

/**
 * Action: parse the query form buffer and route to the query-results view.
 */
export async function submitDDBQuery(plugin: NvimPlugin): Promise<void> {
  const nvim = plugin.nvim
  const tableDesc = getTableDescription()

  if (!tableDesc) {
    await nvim.errWrite('No table schema loaded. Re-open the query view.\n')
    return
  }

  try {
    // Read all non-comment lines from the buffer
    const buffer = await nvim.buffer
    const allLines: string[] = await nvim.call('nvim_buf_get_lines', [
      buffer,
      0,
      -1,
      false,
    ])
    const formLines = allLines.filter((l) => !l.trimStart().startsWith('#'))

    const getValue = (prefix: string): string => {
      const line = formLines.find((l) => l.trimStart().startsWith(prefix))
      return line ? parseFieldValue(line) : ''
    }

    const tableName = getValue('Table:')
    const indexValue = getValue('Index:')
    const pkValue = getValue('PK')
    const skValue = getValue('SK')
    const limitRaw = getValue('Limit:')
    const limit = parseInt(limitRaw, 10) || 50

    if (!pkValue) {
      await nvim.errWrite('PK value is required.\n')
      return
    }

    const { pkName, pkType, skName, skType } = resolveIndexSchema(
      tableDesc,
      indexValue
    )

    const normalizedIndex =
      indexValue.trim().toLowerCase() === '(primary)' ||
      indexValue.trim() === ''
        ? ''
        : indexValue.trim()

    // Pass all params as positional args — empty string means "not provided"
    await handleRoute(plugin, 'dynamo_db_query_results', [
      tableName,
      normalizedIndex,
      pkName,
      pkValue,
      pkType,
      skName ?? '',
      skValue,
      skType ?? '',
      String(limit),
    ])
  } catch (error) {
    await nvim.errWrite(`Error submitting query: ${String(error)}\n`)
  }
}

/**
 * Initialize keybindings for the DDB query form view.
 */
export async function initializeDDBQueryCommands(
  plugin: NvimPlugin,
  buffer: Buffer
): Promise<void> {
  const nvim = plugin.nvim

  // <CR> submits the query form
  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    '<CR>',
    '<cmd>NvimAws action submit<CR>',
    { noremap: true, silent: true, desc: 'Execute DynamoDB query' },
  ])

  // q goes back via jump list
  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'q',
    '<C-o>',
    { noremap: true, silent: true, desc: 'Go back to previous view' },
  ])
}
