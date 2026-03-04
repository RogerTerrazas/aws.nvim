import type { Buffer, NvimPlugin, Window } from 'neovim'
import { queryDynamoDBTable } from '../../../accessors/ddb/query'
import type {
  QueryParams,
  SkCondition,
  SkOperator,
} from '../../../accessors/ddb/query'
import { initializeDDBQueryResultsCommands } from './commands'
import type { ViewRegistryEntry } from '../../../types'
import { VIEW_TO_FILETYPE } from '../../../types'

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

function buildHeader(params: QueryParams, count: number): string[] {
  const indexPart = params.indexName ? ` (index: ${params.indexName})` : ''

  const skPart =
    params.sortKeyName && params.sortKeyCondition
      ? ` AND ${formatSkCondition(params.sortKeyCondition, params.sortKeyName)}`
      : ''

  const query = `${params.partitionKeyName} = "${params.partitionKeyValue}"${skPart}`

  return [
    `DynamoDB Query Results: ${params.tableName}${indexPart}`,
    `Query: ${query}`,
    `Results: ${count} item${count !== 1 ? 's' : ''} (limit: ${params.limit})`,
    '='.repeat(80),
    '',
  ]
}

export async function initializeDDBQueryResultsView(
  plugin: NvimPlugin,
  window: Window,
  args?: string[]
): Promise<void> {
  const nvim = plugin.nvim

  // Args: [tableName, indexName, pkName, pkValue, pkType,
  //        skName, skOperator, skValue, skValue2, skType, limit]
  if (!args || args.length < 5) {
    await nvim.errWrite('Query results view requires query parameters.\n')
    return
  }

  const [
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
    limitRaw,
  ] = args

  // Reconstruct SkCondition from the serialised args
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
    limit: parseInt(limitRaw ?? '50', 10) || 50,
  }

  try {
    const items = await queryDynamoDBTable(params)

    const lines: string[] = [...buildHeader(params, items.length)]

    if (items.length === 0) {
      lines.push('No items found.')
    } else {
      items.forEach((item, index) => {
        lines.push(`Item ${index + 1}:`)
        const jsonLines = JSON.stringify(item, null, 2).split('\n')
        lines.push(...jsonLines)
        lines.push('-'.repeat(80))
      })
    }

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
