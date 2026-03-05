import type { Buffer, NvimPlugin } from 'neovim'
import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import { handleRoute } from '../../../router'
import { getTableDescription } from './query'
import type {
  TableDescription,
  TableIndex,
} from '../../../accessors/ddb/describe-table'
import type { SkCondition, SkOperator } from '../../../accessors/ddb/query'
import type { FilterParams } from '../../../accessors/ddb/items'

// ---------------------------------------------------------------------------
// SK parsing
// ---------------------------------------------------------------------------

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
 *                                  (" AND " is the separator — case-insensitive)
 *
 * Returns null when the raw input is empty (no SK condition).
 */
export function parseSkInput(raw: string): SkCondition | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const lower = trimmed.toLowerCase()

  if (lower.startsWith('begins_with ')) {
    const value = trimmed.slice('begins_with '.length).trim()
    return { operator: 'begins_with', value }
  }

  if (lower.startsWith('between ')) {
    const rest = trimmed.slice('between '.length)
    const andIdx = rest.search(/ and /i)
    if (andIdx !== -1) {
      const value = rest.slice(0, andIdx).trim()
      const value2 = rest.slice(andIdx + ' and '.length).trim()
      return { operator: 'between', value, value2 }
    }
    return { operator: 'between', value: rest.trim(), value2: rest.trim() }
  }

  for (const op of ['<=', '>='] as SkOperator[]) {
    if (trimmed.startsWith(op)) {
      return { operator: op, value: trimmed.slice(op.length).trim() }
    }
  }

  for (const op of ['<', '>', '='] as SkOperator[]) {
    if (trimmed.startsWith(op)) {
      return { operator: op, value: trimmed.slice(op.length).trim() }
    }
  }

  return { operator: '=', value: trimmed }
}

// ---------------------------------------------------------------------------
// Filter parsing
// ---------------------------------------------------------------------------

/**
 * Infer DynamoDB attribute type from a string value.
 * Anything that coerces cleanly to a finite number is treated as N; otherwise S.
 */
export function inferValueType(value: string): 'S' | 'N' {
  const trimmed = value.trim()
  if (trimmed !== '' && !isNaN(Number(trimmed))) return 'N'
  return 'S'
}

function marshalFilterValue(value: string): AttributeValue {
  return inferValueType(value) === 'N'
    ? { N: value.trim() }
    : { S: value.trim() }
}

/**
 * Parse a raw filter field value of the form "<attr> <op> <value>" into a
 * FilterParams object ready to attach to a Scan or Query command.
 *
 * The attribute name is everything before the first recognised operator token.
 * The value portion is parsed with the same rules as parseSkInput (supports
 * all operators including begins_with and between … AND …).
 *
 * Type inference: numeric-looking values → N, everything else → S.
 *
 * Returns null when the raw input is empty.
 */
export function parseFilterInput(raw: string): FilterParams | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Operator tokens to try, longest-match first
  const operators = [
    'begins_with ',
    'between ',
    '<=',
    '>=',
    '<',
    '>',
    '=',
  ] as const

  for (const op of operators) {
    const opLower = op.toLowerCase()
    const lowerTrimmed = trimmed.toLowerCase()
    const idx = lowerTrimmed.indexOf(opLower)
    if (idx === -1) continue

    // For symbol operators (<=, >=, <, >, =) the attribute name is whatever
    // precedes the operator. For keyword operators (begins_with, between) the
    // attribute name precedes the keyword token.
    const attrName = trimmed.slice(0, idx).trim()
    if (!attrName) continue

    const valueRaw = trimmed.slice(idx + op.length).trim()
    const condition = parseSkInput(
      op.startsWith('b') ? `${op}${valueRaw}` : `${op.trim()} ${valueRaw}`
    )
    if (!condition) continue

    const attributeNames: Record<string, string> = { '#f': attrName }
    const attributeValues: Record<string, AttributeValue> = {}
    let expression: string

    if (condition.operator === 'between') {
      attributeValues[':f1'] = marshalFilterValue(condition.value)
      attributeValues[':f2'] = marshalFilterValue(
        condition.value2 ?? condition.value
      )
      expression = '#f BETWEEN :f1 AND :f2'
    } else if (condition.operator === 'begins_with') {
      attributeValues[':f'] = marshalFilterValue(condition.value)
      expression = 'begins_with(#f, :f)'
    } else {
      attributeValues[':f'] = marshalFilterValue(condition.value)
      expression = `#f ${condition.operator} :f`
    }

    return { expression, attributeNames, attributeValues }
  }

  return null
}

// ---------------------------------------------------------------------------
// Index schema resolution
// ---------------------------------------------------------------------------

function parseFieldValue(line: string): string {
  const colonIdx = line.indexOf(': ')
  if (colonIdx === -1) return ''
  return line.slice(colonIdx + 2).trim()
}

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

  return {
    pkName: tableDesc.keySchema.partitionKey.name,
    pkType: tableDesc.keySchema.partitionKey.type,
    skName: tableDesc.keySchema.sortKey?.name,
    skType: tableDesc.keySchema.sortKey?.type,
  }
}

// ---------------------------------------------------------------------------
// Submit action
// ---------------------------------------------------------------------------

/**
 * Action: parse the query form buffer and route to the query-results view.
 *
 * Routing logic:
 *   PK set              → mode=query  (QueryCommand, optionally + FilterExpression)
 *   PK empty, Filter set → mode=scan   (ScanCommand with FilterExpression)
 *   both empty          → error
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
    const filterRaw = getValue('Filter:')
    const limitRaw = getValue('Limit:')
    const limit = parseInt(limitRaw, 10) || 50

    const filter = parseFilterInput(filterRaw)

    if (!pkValue && !filter) {
      await nvim.errWrite('PK or Filter is required.\n')
      return
    }

    const mode = pkValue ? 'query' : 'scan'

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

    const filterExpr = filter?.expression ?? ''
    const filterNamesJson = filter ? JSON.stringify(filter.attributeNames) : ''
    const filterValuesJson = filter
      ? JSON.stringify(filter.attributeValues)
      : ''

    // Args: [mode, tableName, indexName, pkName, pkValue, pkType,
    //        skName, skOperator, skValue, skValue2, skType,
    //        filterExpr, filterNamesJson, filterValuesJson, limit]
    await handleRoute(plugin, 'dynamo_db_query_results', [
      mode,
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
      filterExpr,
      filterNamesJson,
      filterValuesJson,
      String(limit),
    ])
  } catch (error) {
    await nvim.errWrite(`Error submitting query: ${String(error)}\n`)
  }
}

// ---------------------------------------------------------------------------
// Keybindings
// ---------------------------------------------------------------------------

export async function initializeDDBQueryCommands(
  plugin: NvimPlugin,
  buffer: Buffer
): Promise<void> {
  const nvim = plugin.nvim

  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    '<CR>',
    '<cmd>NvimAws action submit<CR>',
    { noremap: true, silent: true, desc: 'Execute DynamoDB query' },
  ])

  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'q',
    '<C-o>',
    { noremap: true, silent: true, desc: 'Go back to previous view' },
  ])
}
