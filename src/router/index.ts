import { NvimPlugin } from 'neovim'
import type {
  ViewRegistryEntry,
  CommandType,
  BufferFiletype,
  BufferLabelResolver,
} from '../types'
import { FILETYPE_TO_VIEW } from '../types'
import { getBufferTitle } from '../session/index'

/**
 * Registry for all views and their associated actions
 */
class ViewRegistry {
  private views: Map<string, ViewRegistryEntry> = new Map()
  private currentView: string | null = null

  /**
   * Register a view with its initializer and actions
   */
  register(entry: ViewRegistryEntry): void {
    this.views.set(entry.name, entry)
  }

  /**
   * Get a view entry by name
   */
  get(name: string): ViewRegistryEntry | undefined {
    return this.views.get(name)
  }

  /**
   * Set the current view
   */
  setCurrentView(name: string): void {
    this.currentView = name
  }

  /**
   * Get the current view name
   */
  getCurrentView(): string | null {
    return this.currentView
  }

  /**
   * Get all registered view names
   */
  getViewNames(): string[] {
    return Array.from(this.views.keys())
  }
}

// Global view registry instance
export const viewRegistry = new ViewRegistry()

/**
 * Parse command arguments into command type, target, and additional args
 */
export function parseCommand(args: string[]): {
  type: CommandType | null
  target: string | null
  additionalArgs: string[]
} {
  if (args.length === 0) {
    return { type: null, target: null, additionalArgs: [] }
  }

  const [commandType, target, ...additionalArgs] = args

  if (commandType !== 'route' && commandType !== 'action') {
    return { type: null, target: null, additionalArgs: [] }
  }

  return {
    type: commandType as CommandType,
    target: target || null,
    additionalArgs,
  }
}

/**
 * Resolve a BufferLabelResolver to a concrete label string.
 */
function resolveBufferLabel(
  resolver: BufferLabelResolver,
  args: string[]
): string {
  return typeof resolver === 'function' ? resolver(...args) : resolver
}

/**
 * Search for an existing buffer by name using Neovim's built-in bufnr().
 * Returns the buffer handle (number) if a valid, loaded buffer is found,
 * or null otherwise.
 *
 * We use bufnr() rather than iterating nvim_list_bufs + nvim_buf_get_name
 * because nvim_buf_get_name returns a fully-resolved absolute path, which
 * may not match the short name originally passed to nvim_buf_set_name.
 * bufnr() performs the same name matching that Neovim itself uses.
 */
async function findExistingBuffer(
  nvim: any,
  targetName: string
): Promise<number | null> {
  // bufnr() returns -1 when no buffer with that name exists
  const bufnr: number = await nvim.call('bufnr', [targetName])
  if (bufnr === -1) return null

  const valid: boolean = await nvim.call('nvim_buf_is_valid', [bufnr])
  return valid ? bufnr : null
}

/**
 * Handle route command - navigate to a specific view
 */
export async function handleRoute(
  plugin: NvimPlugin,
  target: string,
  args: string[]
): Promise<void> {
  const nvim = plugin.nvim
  const viewEntry = viewRegistry.get(target)

  if (!viewEntry) {
    const availableViews = viewRegistry.getViewNames().join(', ')
    await nvim.errWrite(
      `Unknown view: ${target}. Available views: ${availableViews}\n`
    )
    return
  }

  try {
    // Use the current window
    const window = await nvim.window

    // Check if a buffer for this view already exists and reuse it
    const label = resolveBufferLabel(viewEntry.bufferLabel, args)
    const expectedName = getBufferTitle(label)
    const existingBuf = await findExistingBuffer(nvim, expectedName)

    if (existingBuf !== null) {
      // Switch to the existing buffer — let Neovim handle it
      await nvim.call('nvim_win_set_buf', [window.id, existingBuf])
      viewRegistry.setCurrentView(target)
      return
    }

    // No existing buffer — initialize the view (creates a new buffer)
    await viewEntry.initialize(plugin, window, args)

    // Set this as the current view
    viewRegistry.setCurrentView(target)
  } catch (error) {
    await nvim.errWrite(`Error routing to ${target}: ${String(error)}\n`)
  }
}

/**
 * Detect the current view based on buffer filetype
 */
async function detectCurrentView(nvim: any): Promise<string | null> {
  try {
    const buffer = await nvim.buffer
    const filetype = await nvim.call('nvim_buf_get_option', [
      buffer,
      'filetype',
    ])

    // Map filetype to view name using typed mapping
    return FILETYPE_TO_VIEW[filetype as BufferFiletype] || null
  } catch (error) {
    return null
  }
}

/**
 * Handle action command - execute action on current view
 */
export async function handleAction(
  plugin: NvimPlugin,
  target: string,
  args: string[]
): Promise<void> {
  const nvim = plugin.nvim

  // Detect the current view based on buffer filetype
  const currentView = await detectCurrentView(nvim)

  if (!currentView) {
    await nvim.errWrite(
      'No current view. Use "route" to navigate to a view first.\n'
    )
    return
  }

  const viewEntry = viewRegistry.get(currentView)
  if (!viewEntry || !viewEntry.actions) {
    await nvim.errWrite(
      `No actions available for current view: ${currentView}\n`
    )
    return
  }

  const action = viewEntry.actions[target]
  if (!action) {
    const availableActions = Object.keys(viewEntry.actions).join(', ')
    await nvim.errWrite(
      `Unknown action: ${target}. Available actions: ${availableActions}\n`
    )
    return
  }

  try {
    await action(plugin, args)
  } catch (error) {
    await nvim.errWrite(`Error executing action ${target}: ${String(error)}\n`)
  }
}

/**
 * Main router function to handle all NvimAws commands
 */
export async function router(
  plugin: NvimPlugin,
  args: string[]
): Promise<void> {
  const nvim = plugin.nvim

  // Default to routing to the home/landing view if no args provided
  if (args.length === 0) {
    await handleRoute(plugin, 'aws_home', [])
    return
  }

  const { type, target, additionalArgs } = parseCommand(args)

  if (!type || !target) {
    await nvim.errWrite(
      'Usage: NvimAws <route|action> <target> [args...]\n' +
        'Examples:\n' +
        '  NvimAws                         (opens home/landing view)\n' +
        '  NvimAws route dynamo_db_tables\n' +
        '  NvimAws action select\n'
    )
    return
  }

  switch (type) {
    case 'route':
      await handleRoute(plugin, target, additionalArgs)
      break
    case 'action':
      await handleAction(plugin, target, additionalArgs)
      break
  }
}
