import type { Buffer, NvimPlugin } from 'neovim'
import { parseAwsConfig } from '../../accessors/config/profiles'
import { setActiveProfile } from '../../session/index'
import { handleRoute } from '../../router'

/**
 * Parse the profile name from a formatted profile line.
 *
 * Line format: "▶ profile-name   region" or "  profile-name   region"
 * The marker (▶ or space) occupies 1 char, followed by a space, then the
 * profile name (which runs until 2+ consecutive spaces or end of meaningful text).
 */
export function parseProfileNameFromLine(line: string): string {
  // Strip the leading marker + space: "▶ " or "  "
  const content = line.slice(2)
  // The profile name is the first whitespace-delimited token
  const match = /^(\S+)/.exec(content)
  return match ? match[1]! : ''
}

/**
 * Action: Select the AWS profile on the current line and route to tables view.
 */
export async function selectAccount(plugin: NvimPlugin): Promise<void> {
  const nvim = plugin.nvim

  try {
    const line: string = await nvim.line
    const profileName = parseProfileNameFromLine(line)

    if (!profileName) {
      await nvim.command('echo "No profile name on current line"')
      return
    }

    // Look up the full profile object (to get region etc.)
    const profiles = await parseAwsConfig()
    const profile = profiles.find((p) => p.name === profileName)

    if (!profile) {
      await nvim.errWrite(`Profile "${profileName}" not found in config.\n`)
      return
    }

    setActiveProfile(profile)

    await nvim.command(
      `echo "Switched to AWS profile: ${profile.name}${profile.region ? ' (' + profile.region + ')' : ''}"`
    )

    // Navigate to the DynamoDB tables view with the new profile
    await handleRoute(plugin, 'dynamo_db_tables', [])
  } catch (error) {
    await nvim.errWrite(`Error selecting profile: ${String(error)}\n`)
  }
}

/**
 * Initialize keybindings for the accounts view.
 */
export async function initializeAccountsCommands(
  plugin: NvimPlugin,
  buffer: Buffer
): Promise<void> {
  const nvim = plugin.nvim

  // Enter key selects the profile
  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    '<CR>',
    '<cmd>NvimAws action select<CR>',
    { noremap: true, silent: true, desc: 'Select AWS profile' },
  ])

  // q goes back via jump list
  await nvim.call('nvim_buf_set_keymap', [
    buffer,
    'n',
    'q',
    '<C-o>',
    { noremap: true, silent: true, desc: 'Go back to previous view' },
  ])
}
