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
export type ViewName = 'dynamo_db_tables' | 'dynamo_db_table' | string

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
