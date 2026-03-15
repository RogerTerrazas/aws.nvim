import type { Buffer, NvimPlugin, Window } from 'neovim'
import { getActiveProfile, getBufferTitle } from '../../session/index'
import type { ViewRegistryEntry } from '../../types'
import { VIEW_TO_FILETYPE } from '../../types'
import { logger } from '../../utils/logger'
import { initializeHomeCommands, selectHomeEntry } from './commands'

// ─── Layout helpers ──────────────────────────────────────────────────────────

const LOGO = [
  '             _                                    ',
  '  _ ____   _(_)_ __ ___         __ ___      _____ ',
  " | '_ \\ \\ / / | '_ ` _ \\ _____ / _` \\ \\ /\\ / / __|",
  ' | | | \\ V /| | | | | | |_____| (_| |\\ V  V /\\__ \\',
  ' |_| |_|\\_/ |_|_| |_| |_|      \\__,_| \\_/\\_/ |___/',
  '                                                  ',
]

interface MenuItem {
  key: string
  label: string
  description: string
}

const MENU_ITEMS: MenuItem[] = [
  {
    key: 'd',
    label: 'DynamoDB Tables',
    description: 'Browse and query DynamoDB tables',
  },
  {
    key: 'c',
    label: 'CloudWatch Logs Insights',
    description: 'Query CloudWatch log groups with Logs Insights',
  },
  {
    key: 'a',
    label: 'AWS Accounts',
    description: 'Switch the active AWS profile',
  },
]

/**
 * Build the full set of lines for the home buffer.
 *
 * Layout (each section separated by a blank line):
 *
 *   <logo>
 *
 *   Profile: <name>  Region: <region>   (or "No active profile")
 *
 *   <menu entries>
 *
 *   <keybinding legend>
 */
export function buildHomeLines(): string[] {
  const lines: string[] = []

  // ── Logo ──────────────────────────────────────────────────────────────────
  for (const row of LOGO) {
    lines.push(row)
  }
  lines.push('')

  // ── Active profile banner ─────────────────────────────────────────────────
  const profile = getActiveProfile()
  if (profile) {
    const region = profile.region ?? '(no region)'
    lines.push(`  Profile: ${profile.name}   Region: ${region}`)
  } else {
    lines.push('  No active profile — select one from AWS Accounts')
  }
  lines.push('')

  // ── Menu entries ──────────────────────────────────────────────────────────
  // The row index of the first menu entry must align with MENU_ENTRIES in
  // commands.ts (0-based cursor row == lines.length at this point).
  const labelWidth = Math.max(...MENU_ITEMS.map((m) => m.label.length))

  for (const item of MENU_ITEMS) {
    const label = item.label.padEnd(labelWidth)
    lines.push(`  > ${label}   ${item.description}`)
  }
  lines.push('')

  // ── Keybinding legend ─────────────────────────────────────────────────────
  lines.push('  Keybindings')
  lines.push('  ──────────────────────────────────────')
  for (const item of MENU_ITEMS) {
    lines.push(`  ${item.key}  →  ${item.label}`)
  }
  lines.push('  <CR>  →  Open selection under cursor')

  return lines
}

// ─── View initializer ────────────────────────────────────────────────────────

export async function initializeHomeView(
  plugin: NvimPlugin,
  window: Window,
  _args?: string[]
): Promise<void> {
  const nvim = plugin.nvim

  const lines = buildHomeLines()

  logger.debug('initializeHomeView: creating buffer', {
    lineCount: lines.length,
  })

  const buffer = (await nvim.createBuffer(true, true)) as Buffer

  await nvim.call('nvim_buf_set_option', [buffer, 'buftype', 'nofile'])
  await nvim.call('nvim_buf_set_option', [buffer, 'bufhidden', 'hide'])
  await nvim.call('nvim_buf_set_option', [
    buffer,
    'filetype',
    VIEW_TO_FILETYPE.aws_home,
  ])

  await nvim.call('nvim_buf_set_lines', [buffer, 0, -1, false, lines])
  await nvim.call('nvim_buf_set_option', [buffer, 'modifiable', false])

  const bufferTitle = getBufferTitle('Home')
  await nvim.call('nvim_buf_set_name', [buffer, bufferTitle])

  logger.debug('initializeHomeView: setting buffer in window', {
    bufnr: buffer.id,
    windowId: window.id,
    bufferTitle,
  })
  await nvim.call('nvim_win_set_buf', [window.id, buffer])
  logger.info('initializeHomeView: buffer set in window', {
    bufnr: buffer.id,
    lineCount: lines.length,
  })

  await initializeHomeCommands(plugin, buffer)
}

// ─── Registry entry ───────────────────────────────────────────────────────────

export const homeViewEntry: ViewRegistryEntry = {
  name: 'aws_home',
  bufferLabel: 'Home',
  initialize: initializeHomeView,
  actions: {
    select: selectHomeEntry,
  },
}
