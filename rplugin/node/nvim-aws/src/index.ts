import { NvimPlugin } from "neovim";

// Plugin entry point for Neovim remote plugin
export default function (plugin: NvimPlugin): void {
  // Register the plugin with Neovim
  plugin.setOptions({ dev: false });

  // Register a command that can be called from Neovim
  plugin.registerCommand(
    "NvimAwsNode",
    async () => {
      try {
        await plugin.nvim.outWrite("nvim-aws Node.js plugin loaded!\n");
      } catch (error) {
        await plugin.nvim.errWrite(`Error: ${String(error)}\n`);
      }
    },
    { sync: false }
  );

  // Register a function that Lua code can call
  plugin.registerFunction(
    "NvimAwsGetMessage",
    () => {
      return "Hello from TypeScript!";
    },
    { sync: true }
  );
}
