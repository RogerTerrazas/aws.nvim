import type { Buffer, NvimPlugin } from 'neovim'
import { handleRoute } from '../../../router'
import { getLastQueryParams } from './query-results'

// ---------------------------------------------------------------------------
// Refresh action
// ---------------------------------------------------------------------------

/**
 * Action: re-run the last CW Insights query with updated end time (now).
 *
 * Re-uses all original parameters but resets endTime to the current time
 * so the user gets fresh results without having to go back to the form.
 */
export async function refreshCWQuery(plugin: NvimPlugin): Promise<void> {
  const nvim = plugin.nvim
  const params = getLastQueryParams()

  if (!params) {
    await nvim.errWrite(
      'No query parameters available. Please run a query first.\n'
    )
    return
  }

  // Recalculate time window using the same duration but ending at now
  const originalDuration = params.endTime - params.startTime
  const newEndTime = Math.floor(Date.now() / 1000)
  const newStartTime = newEndTime - originalDuration

  await handleRoute(plugin, 'cloudwatch_query_results', [
    JSON.stringify(params.logGroupNames),
    params.queryString,
    String(newStartTime),
    String(newEndTime),
    String(params.limit),
  ])
}

// ---------------------------------------------------------------------------
// Keybindings
// ---------------------------------------------------------------------------

export async function initializeCWQueryResultsCommands(
  plugin: NvimPlugin,
  buffer: Buffer
): Promise<void> {
  const nvim = plugin.nvim

  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'q',
    '<C-o>',
    { noremap: true, silent: true, desc: 'Go back to query form' },
  ])

  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'r',
    '<cmd>NvimAws action refresh<CR>',
    {
      noremap: true,
      silent: true,
      desc: 'Refresh — re-run query with current time',
    },
  ])
}
