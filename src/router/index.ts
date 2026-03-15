import { NvimPlugin } from 'neovim'
import type {
  ViewRegistryEntry,
  CommandType,
  BufferFiletype,
  BufferLabelResolver,
} from '../types'
import { FILETYPE_TO_VIEW } from '../types'
import { getBufferTitle } from '../session/index'
import { logger } from '../utils/logger'

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

  logger.debug('findExistingBuffer: bufnr lookup', { targetName, bufnr })

  if (bufnr === -1) {
    logger.debug('findExistingBuffer: no buffer found', { targetName })
    return null
  }

  const valid: boolean = await nvim.call('nvim_buf_is_valid', [bufnr])
  const result = valid ? bufnr : null

  logger.debug('findExistingBuffer: validity check', {
    targetName,
    bufnr,
    valid,
    returning: result,
  })

  return result
}

/**
 * Tracks views whose initialize() is currently in progress.
 *
 * Because all NvimAws commands are fire-and-forget (sync: false), a user can
 * trigger a second route to the same view before the first async initialize()
 * call completes. Without this guard the following race occurs:
 *
 *   1. initialize() is called — AWS request in flight
 *   2. User triggers the same route again
 *   3. Second handleRoute runs, finds no named buffer yet (it's still being
 *      built), launches a second initialize() in parallel
 *   4. Both initializers eventually call nvim_buf_set_name with the same
 *      title. The second one may finish first (or fail), leaving a named-but-
 *      empty orphan buffer that the first run then can't name correctly.
 *
 * The fix: if a route is already in flight for a given key (target + args),
 * the duplicate invocation is dropped and logged.
 */
const inFlightRoutes = new Set<string>()

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

  logger.info('handleRoute: start', { target, args })

  // Fix 2: Deduplicate concurrent route calls for the same view+args.
  // Use target + serialised args as the key so that parameterised views
  // (e.g. dynamo_db_table with different table names) are treated as distinct.
  const routeKey = `${target}:${args.join(',')}`

  if (inFlightRoutes.has(routeKey)) {
    logger.warn('handleRoute: duplicate route already in flight, dropping', {
      target,
      args,
      routeKey,
    })
    return
  }

  inFlightRoutes.add(routeKey)

  try {
    // Use the current window — captured once here so that the window handle
    // passed to initialize() is consistent for the duration of this call.
    const window = await nvim.window

    // Check if a buffer for this view already exists and reuse it
    const label = resolveBufferLabel(viewEntry.bufferLabel, args)
    const expectedName = getBufferTitle(label)
    const existingBuf = await findExistingBuffer(nvim, expectedName)

    if (existingBuf !== null) {
      // Inspect line count before reuse — a count of 0 means the buffer was
      // previously created but never populated (orphaned by a prior failed or
      // interrupted initialize()). Treat it as if it doesn't exist: wipe it
      // and fall through to a fresh initialize().
      const lineCount: number = await nvim.call('nvim_buf_line_count', [
        existingBuf,
      ])

      logger.info('handleRoute: found existing buffer', {
        target,
        expectedName,
        bufnr: existingBuf,
        lineCount,
      })

      // Fix 3: Wipe empty orphan buffers instead of displaying them.
      if (lineCount === 0) {
        logger.warn(
          'handleRoute: existing buffer is EMPTY — wiping and re-initializing',
          { target, expectedName, bufnr: existingBuf }
        )
        // force:true so the wipe succeeds even if the buffer is displayed
        // somewhere; Neovim will substitute a new empty buffer in its place.
        await nvim.call('nvim_buf_delete', [existingBuf, { force: true }])
      } else {
        // Buffer is healthy — reuse it.
        logger.info('handleRoute: reusing existing buffer', {
          target,
          expectedName,
          bufnr: existingBuf,
          lineCount,
        })
        await nvim.call('nvim_win_set_buf', [window.id, existingBuf])
        viewRegistry.setCurrentView(target)
        return
      }
    }

    // No existing buffer (or the orphan was just wiped) — initialize the view.
    logger.info('handleRoute: initializing view', {
      target,
      expectedName,
      args,
    })

    // Fix 1: Track the buffer created during initialize() so that if the call
    // throws after nvim_buf_set_name but before nvim_win_set_buf we can clean
    // up the orphan.  We do this by listing buffers before and after the call
    // and deleting any newly named plugin buffer that wasn't set in the window.
    const bufsBeforeInit: number[] = await nvim.call('nvim_list_bufs', [])

    try {
      await viewEntry.initialize(plugin, window, args)
      logger.info('handleRoute: view initialized successfully', { target })
    } catch (initError) {
      // Fix 1: initialize() threw — find and delete any buffer it may have
      // created and named before the error, so it can't become an orphan.
      logger.error('handleRoute: initialize() threw, cleaning up orphans', {
        target,
        error: String(initError),
      })

      const bufsAfterInit: number[] = await nvim.call('nvim_list_bufs', [])
      const newBufs = bufsAfterInit.filter((b) => !bufsBeforeInit.includes(b))

      for (const orphanBuf of newBufs) {
        const name: string = await nvim.call('nvim_buf_get_name', [orphanBuf])
        // Only wipe buffers this plugin created (name starts with "nvim-aws |")
        if (name.includes('nvim-aws |')) {
          logger.warn('handleRoute: deleting orphan buffer', {
            bufnr: orphanBuf,
            name,
          })
          await nvim.call('nvim_buf_delete', [orphanBuf, { force: true }])
        }
      }

      await nvim.errWrite(`Error routing to ${target}: ${String(initError)}\n`)
      return
    }

    // Set this as the current view
    viewRegistry.setCurrentView(target)
  } catch (error) {
    logger.error('handleRoute: caught unexpected error', {
      target,
      error: String(error),
    })
    await nvim.errWrite(`Error routing to ${target}: ${String(error)}\n`)
  } finally {
    // Always release the in-flight lock, even on error.
    inFlightRoutes.delete(routeKey)
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

  logger.debug('handleAction: start', { target, args })

  // Detect the current view based on buffer filetype
  const currentView = await detectCurrentView(nvim)

  logger.debug('handleAction: detected view', { target, currentView })

  if (!currentView) {
    logger.warn('handleAction: no current view detected', { target })
    await nvim.errWrite(
      'No current view. Use "route" to navigate to a view first.\n'
    )
    return
  }

  const viewEntry = viewRegistry.get(currentView)
  if (!viewEntry || !viewEntry.actions) {
    logger.warn('handleAction: no actions available for view', {
      target,
      currentView,
    })
    await nvim.errWrite(
      `No actions available for current view: ${currentView}\n`
    )
    return
  }

  const action = viewEntry.actions[target]
  if (!action) {
    const availableActions = Object.keys(viewEntry.actions).join(', ')
    logger.warn('handleAction: unknown action', {
      target,
      currentView,
      availableActions,
    })
    await nvim.errWrite(
      `Unknown action: ${target}. Available actions: ${availableActions}\n`
    )
    return
  }

  logger.info('handleAction: executing action', { currentView, target, args })

  try {
    await action(plugin, args)
    logger.info('handleAction: action completed', { currentView, target })
  } catch (error) {
    logger.error('handleAction: caught error', {
      currentView,
      target,
      error: String(error),
    })
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
