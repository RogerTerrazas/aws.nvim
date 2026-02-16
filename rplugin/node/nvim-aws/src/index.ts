import { NvimPlugin } from 'neovim'
import { initializeDDBTablesView } from './views/ddb/tables'

// Plugin entry point for Neovim remote plugin
export default function (plugin: NvimPlugin): void {
  // Register the plugin with Neovim
  plugin.setOptions({ dev: false })

  // Register a command to open a window with a message
  plugin.registerCommand(
    'NvimAws',
    async () => {
      try {
        // Initialize tab
        await plugin.nvim.command('tabnew')
        const window = await plugin.nvim.window

        // Initialize view
        await initializeDDBTablesView(plugin.nvim, window)
      } catch (error) {
        await plugin.nvim.errWrite(`Error: ${String(error)}\n`)
      }
    },
    { sync: false }
  )
}
