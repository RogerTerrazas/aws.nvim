import { NvimPlugin } from 'neovim'
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb'

// Plugin entry point for Neovim remote plugin
export default function (plugin: NvimPlugin): void {
  // Register the plugin with Neovim
  plugin.setOptions({ dev: false })

  // Register a command to open a window with a message
  plugin.registerCommand(
    'NvimAws',
    async () => {
      try {
        const config = {} // type is DynamoDBClientConfig
        const client = new DynamoDBClient(config)
        const command = new ListTablesCommand()
        const response = await client.send(command)

        // Create a new buffer
        const buffer = await plugin.nvim.createBuffer(false, true)

        // Convert response to formatted JSON lines
        const lines: string[] = JSON.stringify(
          response['TableNames'],
          null,
          2
        ).split('\n')

        // Set buffer content
        await plugin.nvim.call('nvim_buf_set_lines', [
          buffer,
          0,
          -1,
          false,
          lines,
        ])

        // Make the buffer read-only
        await plugin.nvim.call('nvim_buf_set_option', [
          buffer,
          'modifiable',
          false,
        ])
        await plugin.nvim.call('nvim_buf_set_option', [
          buffer,
          'buftype',
          'nofile',
        ])
        await plugin.nvim.call('nvim_buf_set_option', [
          buffer,
          'bufhidden',
          'wipe',
        ])

        // Open the buffer in a new window (split)
        await plugin.nvim.command('split')
        const window = await plugin.nvim.window
        await plugin.nvim.call('nvim_win_set_buf', [window, buffer])

        // Optional: Set window height
        await plugin.nvim.call('nvim_win_set_height', [window, 15])
      } catch (error) {
        await plugin.nvim.errWrite(`Error: ${String(error)}\n`)
      }
    },
    { sync: false }
  )
}
