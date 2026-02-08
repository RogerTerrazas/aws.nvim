import { NvimPlugin } from 'neovim'

// Plugin entry point for Neovim remote plugin
export default function (plugin: NvimPlugin): void {
    // Register the plugin with Neovim
    plugin.setOptions({ dev: false })

    // Register a command that can be called from Neovim
    plugin.registerCommand(
        'NvimAwsNode',
        async () => {
            try {
                await plugin.nvim.outWrite('nvim-aws Node.js plugin loaded!\n')
            } catch (error) {
                await plugin.nvim.errWrite(`Error: ${String(error)}\n`)
            }
        },
        { sync: false }
    )

    // Register a command to open a window with a message
    plugin.registerCommand(
        'NvimAwsShowMessage',
        async () => {
            try {
                // Create a new buffer
                const buffer = await plugin.nvim.createBuffer(false, true)

                // Set buffer content
                await plugin.nvim.call('nvim_buf_set_lines', [
                    buffer,
                    0,
                    -1,
                    false,
                    ['Hello from typescript'],
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
                await plugin.nvim.call('nvim_win_set_height', [window, 3])
            } catch (error) {
                await plugin.nvim.errWrite(`Error: ${String(error)}\n`)
            }
        },
        { sync: false }
    )

    // Register a function that Lua code can call
    plugin.registerFunction(
        'NvimAwsGetMessage',
        () => {
            return 'Hello from TypeScript!'
        },
        { sync: true }
    )
}
