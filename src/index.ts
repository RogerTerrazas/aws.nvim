import type { NvimPlugin } from 'neovim'
import { router, viewRegistry } from './router'
import { accountsViewEntry } from './views/accounts/accounts'
import { ddbTablesViewEntry } from './views/ddb/tables/tables'
import { ddbTableViewEntry } from './views/ddb/table/table'
import { ddbQueryViewEntry } from './views/ddb/query/query'
import { ddbQueryResultsViewEntry } from './views/ddb/query-results/query-results'

// Plugin entry point for Neovim remote plugin
export default function (plugin: NvimPlugin): void {
  // Register the plugin with Neovim
  plugin.setOptions({ dev: false })

  // Register all views with the view registry
  viewRegistry.register(accountsViewEntry)
  viewRegistry.register(ddbTablesViewEntry)
  viewRegistry.register(ddbTableViewEntry)
  viewRegistry.register(ddbQueryViewEntry)
  viewRegistry.register(ddbQueryResultsViewEntry)

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
