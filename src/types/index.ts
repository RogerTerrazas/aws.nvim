// Type definitions for aws.nvim plugin

import type { NvimPlugin, Window } from "neovim";

export type PluginConfig = Record<string, never>;

export interface WindowState {
  bufnr: number | null;
  winnr: number | null;
}

// View types
export type ViewName =
  | "aws_home"
  | "aws_accounts"
  | "dynamo_db_tables"
  | "dynamo_db_table"
  | "dynamo_db_query"
  | "dynamo_db_query_results"
  | "cloudwatch_query"
  | "cloudwatch_query_results";

// Filetype definitions for buffer filetypes
export type BufferFiletype =
  | "nvim-aws-home"
  | "nvim-aws-accounts"
  | "nvim-aws-ddb-tables"
  | "nvim-aws-ddb-table"
  | "nvim-aws-ddb-query"
  | "nvim-aws-ddb-query-results"
  | "nvim-aws-cw-query"
  | "nvim-aws-cw-query-results";

// Filetype to view name mapping
export const FILETYPE_TO_VIEW: Record<BufferFiletype, ViewName> = {
  "nvim-aws-home": "aws_home",
  "nvim-aws-accounts": "aws_accounts",
  "nvim-aws-ddb-tables": "dynamo_db_tables",
  "nvim-aws-ddb-table": "dynamo_db_table",
  "nvim-aws-ddb-query": "dynamo_db_query",
  "nvim-aws-ddb-query-results": "dynamo_db_query_results",
  "nvim-aws-cw-query": "cloudwatch_query",
  "nvim-aws-cw-query-results": "cloudwatch_query_results",
} as const;

// View name to filetype mapping (reverse lookup)
export const VIEW_TO_FILETYPE: Record<ViewName, BufferFiletype> = {
  aws_home: "nvim-aws-home",
  aws_accounts: "nvim-aws-accounts",
  dynamo_db_tables: "nvim-aws-ddb-tables",
  dynamo_db_table: "nvim-aws-ddb-table",
  dynamo_db_query: "nvim-aws-ddb-query",
  dynamo_db_query_results: "nvim-aws-ddb-query-results",
  cloudwatch_query: "nvim-aws-cw-query",
  cloudwatch_query_results: "nvim-aws-cw-query-results",
} as const;

// View initialization function type
export type ViewInitializer = (
  plugin: NvimPlugin,
  window: Window,
  args?: string[],
) => Promise<void>;

// Action handler function type
export type ActionHandler = (
  plugin: NvimPlugin,
  args?: string[],
) => Promise<void>;

// Buffer label resolver — returns the label passed to getBufferTitle().
// A plain string for static views, or a function for parameterised views
// that derive the label from the route args (e.g. table name).
export type BufferLabelResolver = string | ((...args: string[]) => string);

// View registry entry
export interface ViewRegistryEntry {
  name: ViewName;
  bufferLabel: BufferLabelResolver;
  initialize: ViewInitializer;
  actions?: Record<string, ActionHandler>;
}

// Router command types
export type CommandType = "route" | "action";

export interface RouterCommand {
  type: CommandType;
  target: string;
  args?: string[];
}
