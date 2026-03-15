import type { NvimPlugin } from 'neovim'
import { router, viewRegistry } from './router'
import { logger } from './utils/logger'
import { accountsViewEntry } from './views/accounts/accounts'
import { cwQueryViewEntry } from './views/cloudwatch/query/query'
import { cwQueryResultsViewEntry } from './views/cloudwatch/query-results/query-results'
import { ddbQueryViewEntry } from './views/ddb/query/query'
import { ddbQueryResultsViewEntry } from './views/ddb/query-results/query-results'
import { ddbTableViewEntry } from './views/ddb/table/table'
import { ddbTablesViewEntry } from './views/ddb/tables/tables'
import { homeViewEntry } from './views/home/home'

// Plugin entry point for Neovim remote plugin
export default function (plugin: NvimPlugin): void {
  // Register the plugin with Neovim
  plugin.setOptions({ dev: false })

  logger.info('nvim-aws plugin loaded', {
    pid: process.pid,
    logPath: logger.getLogPath(),
  })

  // Register all views with the view registry
  viewRegistry.register(homeViewEntry)
  viewRegistry.register(accountsViewEntry)
  viewRegistry.register(ddbTablesViewEntry)
  viewRegistry.register(ddbTableViewEntry)
  viewRegistry.register(ddbQueryViewEntry)
  viewRegistry.register(ddbQueryResultsViewEntry)
  viewRegistry.register(cwQueryViewEntry)
  viewRegistry.register(cwQueryResultsViewEntry)

  // Register the unified NvimAws command with arguments
  plugin.registerCommand(
    'NvimAws',
    async (args: string[]) => {
      try {
        await router(plugin, args)
      } catch (error) {
        await plugin.nvim.errWrite(`Error: ${String(error)}\n`)
      }
    },
    { sync: false, nargs: '*' }
  )
}
