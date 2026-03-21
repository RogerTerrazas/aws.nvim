# aws.nvim

A Neovim plugin for AWS, built with TypeScript and Node.js.

The goal of this project is to recreate the AWS console — and go beyond it —
as a terminal interface with keyboard-driven navigation

> **Note:** aws.nvim is a [Node.js remote plugin][rplugin]. It requires Node.js,
> a one-time build step, and a Neovim restart after install or update.
> See [Installation](#installation) for details.

## Demo
![demo](https://github.com/user-attachments/assets/40a088fd-a44d-46fb-a51b-440c4c341aeb)

## Features

- **DynamoDB**
  - Browse all tables in the active account
  - Scan the first 50 items of any table (JSON view)
  - Run full queries with partition key, sort key, filter expressions, and
    secondary index support
- **CloudWatch Logs Insights**
  - Write and run Logs Insights queries against any log groups
  - Configurable time window
  - Results stream in asynchronously as the query polls for completion

## Requirements

| Requirement      | Version |
| ---------------- | ------- |
| Neovim           | ≥ 0.9   |
| Node.js          | ≥ 16    |
| npm              | any     |
| neovim (npm pkg) | any     |

**AWS credentials** must be configured in `~/.aws/config` (the same profiles
you use with the AWS CLI). The plugin reads credentials and region from
whichever profile is active. You can optionally switch profiles via
`:NvimAws route aws_accounts`.

Run `:checkhealth aws` after installing to verify all requirements are met.

## Installation

### lazy.nvim (recommended)

```lua
{
  'rogerterrazas/aws.nvim',
  build = { 'npm install -g neovim && npm install && npm run build', ':UpdateRemotePlugins' },
}
```

> **One-time restart required:**
> After the build completes, **restart Neovim once** so the updated remote-plugin
> manifest takes effect. You only need to do this again if you update the plugin.

### packer.nvim

```lua
use {
  'rogerterrazas/aws.nvim',
  run = 'npm install -g neovim && npm install && npm run build',
}
```

After installing, run `:UpdateRemotePlugins` and **restart Neovim**.

### Manual install

```bash
# Clone into your Neovim packages directory
git clone https://github.com/rogerterrazas/aws.nvim \
  ~/.local/share/nvim/site/pack/plugins/start/aws.nvim

cd ~/.local/share/nvim/site/pack/plugins/start/aws.nvim
npm install -g neovim
npm install
npm run build
```

Then open Neovim, run `:UpdateRemotePlugins`, and **restart Neovim**.

### Why is there a build step?

aws.nvim is written in TypeScript. The `build` command compiles the TypeScript
source to JavaScript (`dist/`) so Neovim's Node.js plugin host can load it. The
plugin's `node_modules/` is fully self-contained and will not interfere with
any TypeScript projects in your workspace.

## Usage

Everything is accessed through the `:NvimAws` command.

### Open the home screen

```vim
:NvimAws
```

### Trigger an action on the current view

```vim
:NvimAws action <action>
```

### Workflow examples

**Browse DynamoDB:**

```vim
:NvimAws route dynamo_db_tables  " list all tables
" press <CR> on a table to scan its items
" press q to open the query form for that table
```

**Run a CloudWatch Logs Insights query:**

```vim
:NvimAws route cloudwatch_query  " open the query form
" fill in time range, log groups, and your Insights query
" press <CR> to run — results load asynchronously
```

## Health check

Run `:checkhealth aws` to verify:

- Node.js is installed and on your `$PATH`
- npm is available
- The plugin has been built (`dist/index.js` exists)
- The `neovim` npm package is present in `node_modules/`

## Troubleshooting

**`:NvimAws` command not found**

You need to run `:UpdateRemotePlugins` and restart Neovim. This is required
after every install or update.

**`Error: Cannot find module '…/dist/index.js'`**

The build step did not run. In the plugin directory, run:

```bash
npm install -g neovim
npm install && npm run build
```

Then run `:UpdateRemotePlugins` and restart Neovim.

**`Error loading plugin` / blank screen**

Check `~/.local/state/nvim/nvim-aws.log` for detailed error output.

**No tables / no log groups shown**

- Confirm your AWS credentials are configured: `aws sts get-caller-identity`
- Check that the active profile has the correct region set in `~/.aws/config`

**Node.js not found**

Ensure `node` is on the `$PATH` that Neovim sees. If you use a version manager
(nvm, fnm, volta), make sure it is initialised before Neovim starts — typically
by sourcing it in your shell's rc file rather than an interactive-only file.

## Logs

The plugin writes debug output to:

```
~/.local/state/nvim/nvim-aws.log
```

## Contributing

See [SETUP.md](SETUP.md) for the development workflow, project architecture,
and instructions on adding new views.

## License

MIT

[rplugin]: https://neovim.io/doc/user/remote_plugin.html
