import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs'
import { fromIni } from '@aws-sdk/credential-providers'
import type { AwsProfile } from '../accessors/config/profiles'

// ---------------------------------------------------------------------------
// Session state — persists for the lifetime of the Neovim remote plugin process
// ---------------------------------------------------------------------------

let activeProfile: AwsProfile | null = null

/**
 * Get the currently active AWS profile, or null if using default credentials.
 */
export function getActiveProfile(): AwsProfile | null {
  return activeProfile
}

/**
 * Set the active AWS profile for this session.
 * All subsequent AWS client creations will use this profile.
 */
export function setActiveProfile(profile: AwsProfile): void {
  activeProfile = profile
}

/**
 * Clear the active profile, reverting to the default credential chain.
 */
export function clearActiveProfile(): void {
  activeProfile = null
}

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------

/**
 * Create a DynamoDBClient configured for the active profile.
 *
 * - If a profile is set, uses fromIni() with that profile name and the
 *   profile's region (if available).
 * - If no profile is set, returns a client using the default credential chain
 *   (env vars, instance metadata, etc.) — identical to previous behaviour.
 */
export function createDynamoDBClient(): DynamoDBClient {
  if (activeProfile) {
    return new DynamoDBClient({
      credentials: fromIni({ profile: activeProfile.name }),
      ...(activeProfile.region ? { region: activeProfile.region } : {}),
    })
  }

  return new DynamoDBClient({})
}

/**
 * Create a CloudWatchLogsClient configured for the active profile.
 *
 * - If a profile is set, uses fromIni() with that profile name and the
 *   profile's region (if available).
 * - If no profile is set, returns a client using the default credential chain.
 */
export function createCloudWatchLogsClient(): CloudWatchLogsClient {
  if (activeProfile) {
    return new CloudWatchLogsClient({
      credentials: fromIni({ profile: activeProfile.name }),
      ...(activeProfile.region ? { region: activeProfile.region } : {}),
    })
  }

  return new CloudWatchLogsClient({})
}

// ---------------------------------------------------------------------------
// Buffer name helper
// ---------------------------------------------------------------------------

/**
 * Build a descriptive buffer name that includes the active profile context.
 *
 * Examples:
 *   getBufferTitle('DynamoDB Tables')
 *     → 'nvim-aws | DynamoDB Tables'                       (no active profile)
 *     → 'nvim-aws | DynamoDB Tables | staging | eu-west-1' (profile selected)
 */
export function getBufferTitle(viewLabel: string): string {
  const base = `nvim-aws | ${viewLabel}`
  if (!activeProfile) return base
  const parts = [base, activeProfile.name]
  if (activeProfile.region) parts.push(activeProfile.region)
  return parts.join(' | ')
}
