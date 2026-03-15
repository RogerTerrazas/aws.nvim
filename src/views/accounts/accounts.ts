import type { Buffer, NvimPlugin, Window } from 'neovim'
import { parseAwsConfig } from '../../accessors/config/profiles'
import type { AwsProfile } from '../../accessors/config/profiles'
import { getActiveProfile } from '../../session/index'
import { getBufferTitle } from '../../session/index'
import { initializeAccountsCommands, selectAccount } from './commands'
import type { ViewRegistryEntry } from '../../types'
import { VIEW_TO_FILETYPE } from '../../types'
import { logger } from '../../utils/logger'

/**
 * Format a single profile line for the accounts buffer.
 *
 * Active profile gets a ▶ marker; inactive profiles get a space.
 *
 * Example:
 *   ▶ default          us-east-1
 *     staging          eu-west-1
 *     production       us-west-2
 */
export function formatProfileLine(
  profile: AwsProfile,
  isActive: boolean,
  maxNameLen: number
): string {
  const marker = isActive ? '▶' : ' '
  const name = profile.name.padEnd(maxNameLen)
  const region = profile.region ?? '(no region)'
  return `${marker} ${name}  ${region}`
}

export async function initializeAccountsView(
  plugin: NvimPlugin,
  window: Window,
  args?: string[]
): Promise<void> {
  const nvim = plugin.nvim

  const profiles = await parseAwsConfig()
  const activeProfile = getActiveProfile()

  const lines: string[] = []

  if (profiles.length === 0) {
    lines.push('No AWS profiles found in ~/.aws/config')
    lines.push('')
    lines.push('Create a profile by adding to ~/.aws/config:')
    lines.push('  [default]')
    lines.push('  region = us-east-1')
  } else {
    // Calculate max profile name length for alignment
    const maxNameLen = Math.max(...profiles.map((p) => p.name.length))

    for (const profile of profiles) {
      const isActive = activeProfile?.name === profile.name
      lines.push(formatProfileLine(profile, isActive, maxNameLen))
    }
  }

  logger.debug('initializeAccountsView: creating buffer', {
    profileCount: lines.length,
  })

  const buffer = (await nvim.createBuffer(true, true)) as Buffer

  await nvim.call('nvim_buf_set_option', [buffer, 'buftype', 'nofile'])
  await nvim.call('nvim_buf_set_option', [buffer, 'bufhidden', 'hide'])
  await nvim.call('nvim_buf_set_option', [
    buffer,
    'filetype',
    VIEW_TO_FILETYPE['aws_accounts'],
  ])

  await nvim.call('nvim_buf_set_lines', [buffer, 0, -1, false, lines])
  await nvim.call('nvim_buf_set_option', [buffer, 'modifiable', false])

  // Set buffer name with profile context
  const bufferTitle = getBufferTitle('AWS Profiles')
  await nvim.call('nvim_buf_set_name', [buffer, bufferTitle])

  logger.debug('initializeAccountsView: setting buffer in window', {
    bufnr: buffer.id,
    windowId: window.id,
    bufferTitle,
  })
  await nvim.call('nvim_win_set_buf', [window.id, buffer])
  logger.info('initializeAccountsView: buffer set in window', {
    bufnr: buffer.id,
    lineCount: lines.length,
  })

  await initializeAccountsCommands(plugin, buffer)
}

/**
 * AWS Accounts View Registry Entry
 */
export const accountsViewEntry: ViewRegistryEntry = {
  name: 'aws_accounts',
  bufferLabel: 'AWS Profiles',
  initialize: initializeAccountsView,
  actions: {
    select: selectAccount,
  },
}
