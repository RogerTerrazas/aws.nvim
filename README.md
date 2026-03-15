# aws.nvim

A Neovim plugin for AWS integration, built with TypeScript and Node.js.

Browse DynamoDB tables, run CloudWatch Logs Insights queries, and switch AWS
profiles — all from inside Neovim.

> **Note:** aws.nvim is a [Node.js remote plugin][rplugin]. It requires Node.js
> and a one-time build step. See [Installation](#installation) for details.

## Demo

<!-- TODO: add a GIF or screenshot here -->

## Features

- **Home view** — ASCII art landing screen with quick navigation menu
- **AWS profile switcher** — select any profile from `~/.aws/config`; all
  subsequent requests use that profile's credentials and region
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

| Requirement | Version |
| ----------- | ------- |
| Neovim      | ≥ 0.9   |
| Node.js     | ≥ 16    |
| npm         | any     |

**AWS credentials** must be configured in `~/.aws/config` (the same profiles
you use with the AWS CLI). The plugin reads credentials and region from
whichever profile you select in the profile switcher.

Run `:checkhealth aws` after installing to verify all requirements are met.

## Installation

### lazy.nvim (recommended)

```lua
{
  'rogerterrazas/aws.nvim',
  build = 'npm install && npm run build',
  config = function()
    -- No setup call is required.
    -- After install or update, run :UpdateRemotePlugins once, then restart Neovim.
  end,
}
```

> **Important — one-time setup step:**
> After installing (or updating) the plugin, you must run `:UpdateRemotePlugins`
> in Neovim and then **restart Neovim**. This registers the `NvimAws` command in
> Neovim's remote-plugin manifest. You only need to do this again if you update
> the plugin.

### packer.nvim

```lua
use {
  'rogerterrazas/aws.nvim',
  run = 'npm install && npm run build',
}
```

After installing, run `:UpdateRemotePlugins` and restart Neovim.

### Manual install

```bash
# Clone into your Neovim packages directory
git clone https://github.com/rogerterrazas/aws.nvim \
  ~/.local/share/nvim/site/pack/plugins/start/aws.nvim

cd ~/.local/share/nvim/site/pack/plugins/start/aws.nvim
npm install
npm run build
```

Then open Neovim, run `:UpdateRemotePlugins`, and restart.

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

### Navigate to a view

```vim
:NvimAws route <view>
```

| View name                  | Description                         |
| -------------------------- | ----------------------------------- |
| `aws_accounts`             | AWS profile switcher                |
| `dynamo_db_tables`         | List all DynamoDB tables            |
| `dynamo_db_table`          | Scan items in a table (50 items)    |
| `dynamo_db_query`          | DynamoDB query form                 |
| `dynamo_db_query_results`  | DynamoDB query / scan results       |
| `cloudwatch_query`         | CloudWatch Logs Insights query form |
| `cloudwatch_query_results` | CloudWatch Logs Insights results    |

### Trigger an action on the current view

```vim
:NvimAws action <action>
```

### Keybindings

Keybindings are set per-buffer when a view is opened.

#### Home

| Key    | Action                         |
| ------ | ------------------------------ |
| `d`    | Go to DynamoDB tables          |
| `c`    | Go to CloudWatch Logs Insights |
| `a`    | Go to AWS profile switcher     |
| `<CR>` | Select highlighted menu item   |

#### AWS Profiles

| Key    | Action                   |
| ------ | ------------------------ |
| `<CR>` | Select profile on cursor |

#### DynamoDB Tables

| Key      | Action                    |
| -------- | ------------------------- |
| `<CR>`   | Open scan view for table  |
| `<C-CR>` | Open scan view for table  |
| `q`      | Open query form for table |
| `a`      | Open AWS profile switcher |

#### DynamoDB Query Form

| Key    | Action       |
| ------ | ------------ |
| `<CR>` | Submit query |

#### DynamoDB Table / Query Results

| Key | Action  |
| --- | ------- |
| `q` | Go back |

#### CloudWatch Logs Insights Query Form

| Key    | Action       |
| ------ | ------------ |
| `<CR>` | Submit query |

#### CloudWatch Logs Insights Results

| Key | Action                                |
| --- | ------------------------------------- |
| `r` | Re-run query with shifted time window |

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

**Switch AWS profile:**

```vim
:NvimAws route aws_accounts  " open profile list
" press <CR> on any profile to activate it
" all subsequent requests use that profile's credentials and region
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
npm install && npm run build
```

Then run `:UpdateRemotePlugins` and restart Neovim.

**`Error loading plugin` / blank screen**

Check `~/.local/state/nvim/nvim-aws.log` for detailed error output.

**No tables / no log groups shown**

- Confirm your AWS credentials are configured: `aws sts get-caller-identity`
- Check that the active profile has the correct region set in `~/.aws/config`
- Use `:NvimAws route aws_accounts` to switch to a different profile

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
