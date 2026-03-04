import type { Buffer, NvimPlugin } from 'neovim'
import { handleRoute } from '../../../router'
import { getTableDescription } from './query'
import type {
  TableDescription,
  TableIndex,
} from '../../../accessors/ddb/describe-table'
import type { SkCondition, SkOperator } from '../../../accessors/ddb/query'

/**
 * Parse the raw SK field value typed by the user into a structured SkCondition.
 *
 * Supported syntax (case-insensitive for keyword operators):
 *   bare value                   → = value          (spaces in value are fine)
 *   = value                      → = value
 *   < value                      → < value
 *   <= value                     → <= value
 *   > value                      → > value
 *   >= value                     → >= value
 *   begins_with value            → begins_with value (spaces in value are fine)
 *   between value1 AND value2    → BETWEEN value1 AND value2
 *                                  (each bound may contain spaces; the literal
 *                                  " AND " — case-insensitive — is the separator)
 *
 * Returns null when the raw input is empty (no SK condition).
 */
export function parseSkInput(raw: string): SkCondition | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const lower = trimmed.toLowerCase()

  // begins_with <value>  — everything after the keyword is the value
  if (lower.startsWith('begins_with ')) {
    const value = trimmed.slice('begins_with '.length).trim()
    return { operator: 'begins_with', value }
  }

  // between <value1> AND <value2>
  // The separator is the literal " AND " (case-insensitive) so both bounds
  // may freely contain spaces (e.g. "between foo bar AND baz qux").
  if (lower.startsWith('between ')) {
    const rest = trimmed.slice('between '.length)
    const andIdx = rest.search(/ and /i)
    if (andIdx !== -1) {
      const value = rest.slice(0, andIdx).trim()
      const value2 = rest.slice(andIdx + ' and '.length).trim()
      return { operator: 'between', value, value2 }
    }
    // No " AND " separator — treat the whole remainder as both bounds
    return { operator: 'between', value: rest.trim(), value2: rest.trim() }
  }

  // Two-char symbol operators first (must precede single-char checks)
  for (const op of ['<=', '>='] as SkOperator[]) {
    if (trimmed.startsWith(op)) {
      const value = trimmed.slice(op.length).trim()
      return { operator: op, value }
    }
  }

  // Single-char symbol operators — everything after the symbol is the value
  for (const op of ['<', '>', '='] as SkOperator[]) {
    if (trimmed.startsWith(op)) {
      const value = trimmed.slice(op.length).trim()
      return { operator: op, value }
    }
  }

  // Bare value — default to equals
  return { operator: '=', value: trimmed }
}

/**
 * Parse a form line of the shape "Label (detail): value" and return the value.
 */
function parseFieldValue(line: string): string {
  const colonIdx = line.indexOf(': ')
  if (colonIdx === -1) return ''
  return line.slice(colonIdx + 2).trim()
}

/**
 * Given a table description and the index name the user entered, resolve the
 * key schema for that index.
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
    const skRaw = getValue('SK')
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

    const skCondition = parseSkInput(skRaw)

    const normalizedIndex =
      indexValue.trim().toLowerCase() === '(primary)' ||
      indexValue.trim() === ''
        ? ''
        : indexValue.trim()

    // Args: [tableName, indexName, pkName, pkValue, pkType,
    //        skName, skOperator, skValue, skValue2, skType, limit]
    await handleRoute(plugin, 'dynamo_db_query_results', [
      tableName,
      normalizedIndex,
      pkName,
      pkValue,
      pkType,
      skName ?? '',
      skCondition?.operator ?? '',
      skCondition?.value ?? '',
      skCondition?.value2 ?? '',
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
