# nvim-aws

A Neovim plugin for AWS integration, built with TypeScript and Node.js.

## Project Structure

```
nvim-aws/
├── src/               # TypeScript source code
│   ├── accessors/     # AWS service accessors (DynamoDB, etc.)
│   ├── views/         # Neovim buffer views and UI
│   ├── types/         # TypeScript type definitions
│   └── index.ts       # Main plugin entry point
├── dist/              # Compiled JavaScript (generated)
├── rplugin/           # Neovim remote plugin entry point
│   └── node/
│       └── nvim-aws.js  # References dist/index.js
├── doc/               # Neovim help documentation
├── package.json       # Node.js dependencies
├── tsconfig.json      # TypeScript configuration
└── vitest.config.ts   # Test configuration
```

## Development

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report
```

### Format Code

```bash
npm run format
npm run format:check
```

## Installation

1. Install the plugin using your favorite Neovim plugin manager
2. Run `:UpdateRemotePlugins` in Neovim
3. Restart Neovim

## Usage

The plugin uses a unified `:NvimAws` command with two operating modes:

### Default Command

Simply run `:NvimAws` to open the DynamoDB tables view:

```vim
:NvimAws
```

### Route Command

Navigate to specific views:

```vim
:NvimAws route dynamo_db_tables
```

### Action Command

Execute view-specific actions on the current view:

```vim
:NvimAws action select    " Select item on current line
:NvimAws action refresh   " Refresh current view
```

### Action Command

Execute view-specific actions on the current view:

```vim
:NvimAws action select    " Select item on current line
:NvimAws action refresh   " Refresh current view
```

### Available Views

- `dynamo_db_tables` - Browse DynamoDB tables

### Available Actions (DynamoDB Tables View)

- `select` - Select the table on the current line (also mapped to `<C-CR>`)
- `refresh` - Refresh the tables list (also mapped to `r`)

## Features

- Unified command interface with `route` and `action` subcommands
- DynamoDB table browsing
- AWS service integration
- Buffer-based UI for AWS resources
- Extensible view and action registry system
