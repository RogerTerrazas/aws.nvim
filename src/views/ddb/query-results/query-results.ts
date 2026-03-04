import type { Buffer, NvimPlugin, Window } from 'neovim'
import { queryDynamoDBTable } from '../../../accessors/ddb/query'
import type { QueryParams } from '../../../accessors/ddb/query'
import { initializeDDBQueryResultsCommands } from './commands'
import type { ViewRegistryEntry } from '../../../types'
import { VIEW_TO_FILETYPE } from '../../../types'

function buildHeader(params: QueryParams, count: number): string[] {
  const indexPart = params.indexName ? ` (index: ${params.indexName})` : ''
  const skPart =
    params.sortKeyName && params.sortKeyValue
      ? ` AND ${params.sortKeyName} = "${params.sortKeyValue}"`
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

  // Args: [tableName, indexName, pkName, pkValue, pkType, skName, skValue, skType, limit]
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
    skValue,
    skType,
    limitRaw,
  ] = args

  const params: QueryParams = {
    tableName: tableName ?? '',
    ...(indexName ? { indexName } : {}),
    partitionKeyName: pkName ?? '',
    partitionKeyValue: pkValue ?? '',
    partitionKeyType: pkType ?? 'S',
    ...(skName && skValue && skType
      ? { sortKeyName: skName, sortKeyValue: skValue, sortKeyType: skType }
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
