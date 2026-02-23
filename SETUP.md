# Setup Guide

## After Rearchitecture Changes

### 1. Update Remote Plugins

Since the command signature changed, you need to update Neovim's remote plugin manifest:

```vim
:UpdateRemotePlugins
```

### 2. Restart Neovim

Completely close and reopen Neovim for changes to take effect.

### 3. Test the New Commands

#### Open DynamoDB Tables View (Default)

```vim
:NvimAws
```

Or explicitly route to it:

```vim
:NvimAws route dynamo_db_tables
```

This will:

- Open a new tab
- Display a list of your DynamoDB tables
- Set up keybindings for the view

#### Use Actions (when in a view)

```vim
:NvimAws action select
:NvimAws action refresh
```

Or use the keybindings:

- `<C-CR>` - Select table on current line
- `r` - Refresh the tables list

### 4. Verify Installation

#### Expected Behavior:

```vim
:NvimAws
" Opens DynamoDB tables view in new tab (default behavior)

:NvimAws route dynamo_db_tables
" Same as above - explicitly routes to DynamoDB tables view
```

### 5. Troubleshooting

#### Command not found

- Run `:UpdateRemotePlugins`
- Restart Neovim
- Check that the plugin is in your plugin directory

#### "Unknown view" error

- Make sure you're using the exact view name: `dynamo_db_tables`
- Check available views are registered in `src/index.ts`

#### "No current view" error for actions

- You must first navigate to a view using `route` before using `action`
- Actions only work when you're in a registered view buffer

## Development Workflow

### After making code changes:

1. Build the plugin:

```bash
npm run build
```

2. In Neovim:

```vim
:UpdateRemotePlugins
```

3. Restart Neovim

### Running tests:

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

## Adding New Views

See the DynamoDB tables view as an example:

1. Create view entry in `src/views/<service>/<view>/`:
   - `tables.ts` - View initializer
   - `commands.ts` - Action handlers

2. Export a `ViewRegistryEntry`:

```typescript
export const myViewEntry: ViewRegistryEntry = {
  name: 'my_view_name',
  initialize: initializeMyView,
  actions: {
    myAction: myActionHandler,
  },
}
```

3. Register in `src/index.ts`:

```typescript
viewRegistry.register(myViewEntry)
```

4. Build and update remote plugins
