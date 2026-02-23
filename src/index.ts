import type { NvimPlugin } from 'neovim'
import { router, viewRegistry } from './router'
import { ddbTablesViewEntry } from './views/ddb/tables/tables'
import { ddbTableViewEntry } from './views/ddb/table/table'

// Plugin entry point for Neovim remote plugin
export default function (plugin: NvimPlugin): void {
  // Register the plugin with Neovim
  plugin.setOptions({ dev: false })

  // Register all views with the view registry
  viewRegistry.register(ddbTablesViewEntry)
  viewRegistry.register(ddbTableViewEntry)

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
