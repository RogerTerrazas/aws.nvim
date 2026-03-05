import type { Buffer, NvimPlugin, Window } from 'neovim'
import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import { queryDynamoDBTable } from '../../../accessors/ddb/query'
import type {
  QueryParams,
  SkCondition,
  SkOperator,
} from '../../../accessors/ddb/query'
import { scanDynamoDBTable } from '../../../accessors/ddb/items'
import type { DynamoDBItem, FilterParams } from '../../../accessors/ddb/items'
import { initializeDDBQueryResultsCommands } from './commands'
import type { ViewRegistryEntry } from '../../../types'
import { VIEW_TO_FILETYPE } from '../../../types'

// ---------------------------------------------------------------------------
// Header builders
// ---------------------------------------------------------------------------

function formatSkCondition(condition: SkCondition, skName: string): string {
  const { operator, value, value2 } = condition
  if (operator === 'between') {
    return `${skName} BETWEEN "${value}" AND "${value2 ?? value}"`
  }
  if (operator === 'begins_with') {
    return `begins_with(${skName}, "${value}")`
  }
  return `${skName} ${operator} "${value}"`
}

function formatFilter(filter: FilterParams): string {
  // Re-derive a human-readable form from the expression + name map
  const expr = filter.expression
  // Replace #f with the actual attribute name for display
  const attrName = filter.attributeNames['#f'] ?? '#f'
  return expr.replace('#f', attrName)
}

function buildQueryHeader(params: QueryParams, count: number): string[] {
  const indexPart = params.indexName ? ` (index: ${params.indexName})` : ''
  const skPart =
    params.sortKeyName && params.sortKeyCondition
      ? ` AND ${formatSkCondition(params.sortKeyCondition, params.sortKeyName)}`
      : ''
  const filterPart = params.filter
    ? `  [filter: ${formatFilter(params.filter)}]`
    : ''

  const query = `${params.partitionKeyName} = "${params.partitionKeyValue}"${skPart}`

  return [
    `DynamoDB Query Results: ${params.tableName}${indexPart}`,
    `Query: ${query}${filterPart}`,
    `Results: ${count} item${count !== 1 ? 's' : ''} (limit: ${params.limit})`,
    '='.repeat(80),
    '',
  ]
}

function buildScanHeader(
  tableName: string,
  filter: FilterParams,
  limit: number,
  count: number
): string[] {
  return [
    `DynamoDB Scan Results: ${tableName}`,
    `Filter: ${formatFilter(filter)}`,
    `Results: ${count} item${count !== 1 ? 's' : ''} (limit: ${limit})`,
    '='.repeat(80),
    '',
  ]
}

// ---------------------------------------------------------------------------
// Arg deserialisation helpers
// ---------------------------------------------------------------------------

function parseFilterFromArgs(
  filterExpr: string,
  filterNamesJson: string,
  filterValuesJson: string
): FilterParams | undefined {
  if (!filterExpr || !filterNamesJson || !filterValuesJson) return undefined
  try {
    const attributeNames = JSON.parse(filterNamesJson) as Record<string, string>
    const attributeValues = JSON.parse(filterValuesJson) as Record<
      string,
      AttributeValue
    >
    return { expression: filterExpr, attributeNames, attributeValues }
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Item renderer (shared)
// ---------------------------------------------------------------------------

function renderItems(items: DynamoDBItem[]): string[] {
  if (items.length === 0) return ['No items found.']
  const lines: string[] = []
  items.forEach((item, index) => {
    lines.push(`Item ${index + 1}:`)
    lines.push(...JSON.stringify(item, null, 2).split('\n'))
    lines.push('-'.repeat(80))
  })
  return lines
}

// ---------------------------------------------------------------------------
// View initialiser
// ---------------------------------------------------------------------------

export async function initializeDDBQueryResultsView(
  plugin: NvimPlugin,
  window: Window,
  args?: string[]
): Promise<void> {
  const nvim = plugin.nvim

  // Args: [mode, tableName, indexName, pkName, pkValue, pkType,
  //        skName, skOperator, skValue, skValue2, skType,
  //        filterExpr, filterNamesJson, filterValuesJson, limit]
  if (!args || args.length < 2) {
    await nvim.errWrite('Query results view requires query parameters.\n')
    return
  }

  const [
    mode,
    tableName,
    indexName,
    pkName,
    pkValue,
    pkType,
    skName,
    skOperator,
    skValue,
    skValue2,
    skType,
    filterExpr,
    filterNamesJson,
    filterValuesJson,
    limitRaw,
  ] = args

  const limit = parseInt(limitRaw ?? '50', 10) || 50

  const filter = parseFilterFromArgs(
    filterExpr ?? '',
    filterNamesJson ?? '',
    filterValuesJson ?? ''
  )

  try {
    let items: DynamoDBItem[]
    let headerLines: string[]

    if (mode === 'scan') {
      // PK was empty — use ScanCommand with FilterExpression
      items = await scanDynamoDBTable(tableName ?? '', limit, filter)
      headerLines = buildScanHeader(
        tableName ?? '',
        filter!,
        limit,
        items.length
      )
    } else {
      // mode === 'query'
      const skCondition: SkCondition | undefined =
        skName && skOperator && skValue
          ? {
              operator: skOperator as SkOperator,
              value: skValue,
              ...(skValue2 ? { value2: skValue2 } : {}),
            }
          : undefined

      const params: QueryParams = {
        tableName: tableName ?? '',
        ...(indexName ? { indexName } : {}),
        partitionKeyName: pkName ?? '',
        partitionKeyValue: pkValue ?? '',
        partitionKeyType: pkType ?? 'S',
        ...(skName && skCondition && skType
          ? {
              sortKeyName: skName,
              sortKeyCondition: skCondition,
              sortKeyType: skType,
            }
          : {}),
        ...(filter ? { filter } : {}),
        limit,
      }

      items = await queryDynamoDBTable(params)
      headerLines = buildQueryHeader(params, items.length)
    }

    const lines: string[] = [...headerLines, ...renderItems(items)]

    const buffer = (await nvim.createBuffer(false, true)) as Buffer

    await nvim.call('nvim_buf_set_option', [buffer, 'buftype', 'nofile'])
    await nvim.call('nvim_buf_set_option', [buffer, 'bufhidden', 'hide'])
    await nvim.call('nvim_buf_set_option', [
      buffer,
      'filetype',
      VIEW_TO_FILETYPE['dynamo_db_query_results'],
    ])

    await nvim.call('nvim_buf_set_lines', [buffer, 0, -1, false, lines])
    await nvim.call('nvim_buf_set_option', [buffer, 'modifiable', false])

    await nvim.call('nvim_win_set_buf', [window.id, buffer])

    await initializeDDBQueryResultsCommands(plugin, buffer)
  } catch (error) {
    await nvim.errWrite(`Error executing query: ${String(error)}\n`)
  }
}

export const ddbQueryResultsViewEntry: ViewRegistryEntry = {
  name: 'dynamo_db_query_results',
  initialize: initializeDDBQueryResultsView,
  actions: {},
}
