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
export type ViewName =
  | 'aws_home'
  | 'aws_accounts'
  | 'dynamo_db_tables'
  | 'dynamo_db_table'
  | 'dynamo_db_query'
  | 'dynamo_db_query_results'

// Filetype definitions for buffer filetypes
export type BufferFiletype =
  | 'nvim-aws-home'
  | 'nvim-aws-accounts'
  | 'nvim-aws-ddb-tables'
  | 'nvim-aws-ddb-table'
  | 'nvim-aws-ddb-query'
  | 'nvim-aws-ddb-query-results'

// Filetype to view name mapping
export const FILETYPE_TO_VIEW: Record<BufferFiletype, ViewName> = {
  'nvim-aws-home': 'aws_home',
  'nvim-aws-accounts': 'aws_accounts',
  'nvim-aws-ddb-tables': 'dynamo_db_tables',
  'nvim-aws-ddb-table': 'dynamo_db_table',
  'nvim-aws-ddb-query': 'dynamo_db_query',
  'nvim-aws-ddb-query-results': 'dynamo_db_query_results',
} as const

// View name to filetype mapping (reverse lookup)
export const VIEW_TO_FILETYPE: Record<ViewName, BufferFiletype> = {
  aws_home: 'nvim-aws-home',
  aws_accounts: 'nvim-aws-accounts',
  dynamo_db_tables: 'nvim-aws-ddb-tables',
  dynamo_db_table: 'nvim-aws-ddb-table',
  dynamo_db_query: 'nvim-aws-ddb-query',
  dynamo_db_query_results: 'nvim-aws-ddb-query-results',
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
