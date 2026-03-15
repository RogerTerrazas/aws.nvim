import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface AwsProfile {
  name: string
  region?: string
}

/**
 * Default path to the AWS config file.
 */
export function defaultConfigPath(): string {
  return join(homedir(), '.aws', 'config')
}

/**
 * Parse the INI-style ~/.aws/config file and return an array of AWS profiles.
 *
 * Recognises two section header forms:
 *   [default]         → { name: 'default' }
 *   [profile staging] → { name: 'staging' }
 *
 * Any other section type (e.g. [sso-session ...]) is ignored.
 *
 * If the file does not exist or cannot be read, returns an empty array.
 */
export async function parseAwsConfig(
  configPath?: string
): Promise<AwsProfile[]> {
  const filePath = configPath ?? defaultConfigPath()

  let content: string
  try {
    content = await readFile(filePath, 'utf-8')
  } catch {
    return []
  }

  return parseAwsConfigContent(content)
}

/**
 * Parse raw INI config content into AwsProfile[].
 * Extracted for testability (no filesystem dependency).
 */
export function parseAwsConfigContent(content: string): AwsProfile[] {
  const profiles: AwsProfile[] = []
  let current: AwsProfile | null = null

  const sectionRegex = /^\[(.+)\]\s*$/
  const keyValueRegex = /^(\w[\w-]*)\s*=\s*(.+)$/

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()

    // Skip empty lines and comments
    if (!line || line.startsWith('#') || line.startsWith(';')) {
      continue
    }

    const sectionMatch = sectionRegex.exec(line)
    if (sectionMatch) {
      // Flush the previous profile
      if (current) {
        profiles.push(current)
      }

      const sectionBody = sectionMatch[1]?.trim() ?? ''

      if (sectionBody === 'default') {
        current = { name: 'default' }
      } else if (sectionBody.startsWith('profile ')) {
        const profileName = sectionBody.slice('profile '.length).trim()
        if (profileName) {
          current = { name: profileName }
        } else {
          current = null
        }
      } else {
        // Not a profile section (e.g. sso-session) — skip
        current = null
      }
      continue
    }

    // Key-value pair within a profile section
    if (current) {
      const kvMatch = keyValueRegex.exec(line)
      if (kvMatch) {
        const key = kvMatch[1] ?? ''
        const value = kvMatch[2]?.trim()

        if (key === 'region' && value !== undefined) {
          current.region = value
        }
      }
    }
  }

  // Flush the last profile
  if (current) {
    profiles.push(current)
  }

  return profiles
}
