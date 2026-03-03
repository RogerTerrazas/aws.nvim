// Type definitions for nvim-aws plugin

import { NvimPlugin, Window } from 'neovim'

export interface PluginConfig {
  // Future configuration options
}

export interface WindowState {
  bufnr: number | null
  winnr: number | null
}

// View types
export type ViewName = 'dynamo_db_tables' | 'dynamo_db_table'

// Filetype definitions for buffer filetypes
export type BufferFiletype = 'nvim-aws-ddb-tables' | 'nvim-aws-ddb-table'

// Filetype to view name mapping
export const FILETYPE_TO_VIEW: Record<BufferFiletype, ViewName> = {
  'nvim-aws-ddb-tables': 'dynamo_db_tables',
  'nvim-aws-ddb-table': 'dynamo_db_table',
} as const

// View name to filetype mapping (reverse lookup)
export const VIEW_TO_FILETYPE: Record<ViewName, BufferFiletype> = {
  dynamo_db_tables: 'nvim-aws-ddb-tables',
  dynamo_db_table: 'nvim-aws-ddb-table',
} as const

// View initialization function type
export type ViewInitializer = (
  plugin: NvimPlugin,
  window: Window,
  args?: string[]
) => Promise<void>

// Action handler function type
export type ActionHandler = (
  plugin: NvimPlugin,
  args?: string[]
) => Promise<void>

// View registry entry
export interface ViewRegistryEntry {
  name: ViewName
  initialize: ViewInitializer
  actions?: Record<string, ActionHandler>
}

// Router command types
export type CommandType = 'route' | 'action'

export interface RouterCommand {
  type: CommandType
  target: string
  args?: string[]
}
