import type { Buffer, NvimPlugin } from 'neovim'
import { handleRoute } from '../../router'

// Each menu entry maps a line index (0-based) to a target view name.
// The order here must match the order in which entries are rendered in home.ts.
const MENU_ENTRIES: string[] = [
  'dynamo_db_tables',
  'cloudwatch_query',
  'aws_accounts',
]

/**
 * Parse the target view from the current cursor line.
 *
 * Lines that begin with "  >" are selectable menu rows. The view name is
 * resolved by the line's position among all such rows.
 */
function getTargetFromLine(line: string, lineIndex: number): string | null {
  if (!line.trimStart().startsWith('>')) return null
  return MENU_ENTRIES[lineIndex] ?? null
}

/**
 * Action: navigate to whichever menu entry the cursor is on.
 */
export async function selectHomeEntry(plugin: NvimPlugin): Promise<void> {
  const nvim = plugin.nvim
  try {
    const window = await nvim.window
    // nvim_win_get_cursor returns [row, col] (1-based row)
    const cursor = (await nvim.call('nvim_win_get_cursor', [
      window.id,
    ])) as number[]
    const row = cursor[0] ?? 1
    const line = await nvim.line

    const target = getTargetFromLine(line, row - 1)
    if (target) {
      await handleRoute(plugin, target, [])
    }
  } catch (error) {
    await nvim.errWrite(`Error selecting home entry: ${String(error)}\n`)
  }
}

/**
 * Register buffer-local keymaps for the home view.
 */
export async function initializeHomeCommands(
  plugin: NvimPlugin,
  buffer: Buffer
): Promise<void> {
  const nvim = plugin.nvim

  // Enter → select the menu item under the cursor
  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    '<CR>',
    '<cmd>NvimAws action select<CR>',
    { noremap: true, silent: true, desc: 'Open selected view' },
  ])

  // Convenience shortcuts
  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'd',
    '<cmd>NvimAws route dynamo_db_tables<CR>',
    { noremap: true, silent: true, desc: 'Go to DynamoDB tables' },
  ])

  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'c',
    '<cmd>NvimAws route cloudwatch_query<CR>',
    { noremap: true, silent: true, desc: 'Go to CloudWatch Logs Insights' },
  ])

  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'a',
    '<cmd>NvimAws route aws_accounts<CR>',
    { noremap: true, silent: true, desc: 'Go to AWS accounts' },
  ])
}
