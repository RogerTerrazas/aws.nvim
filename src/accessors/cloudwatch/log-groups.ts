import {
  DescribeLogGroupsCommand,
  type LogGroup,
} from '@aws-sdk/client-cloudwatch-logs'
import { createCloudWatchLogsClient } from '../../session/index'

export type { LogGroup }

/** Maximum number of log groups to load across all paginated requests. */
const MAX_LOG_GROUPS = 150

/**
 * List CloudWatch log groups for the active profile.
 *
 * Paginates through DescribeLogGroupsCommand (up to 50 per page) until the
 * MAX_LOG_GROUPS cap is reached or all groups have been retrieved.
 *
 * @param prefix - Optional name prefix to filter log groups (e.g. '/aws/lambda')
 * @returns Array of LogGroup objects sorted alphabetically by name
 */
export async function listLogGroups(prefix?: string): Promise<LogGroup[]> {
  const client = createCloudWatchLogsClient()
  const allGroups: LogGroup[] = []
  let nextToken: string | undefined

  do {
    const command = new DescribeLogGroupsCommand({
      ...(prefix ? { logGroupNamePrefix: prefix } : {}),
      ...(nextToken ? { nextToken } : {}),
      limit: 50,
    })

    const response = await client.send(command)
    const groups = response.logGroups ?? []
    allGroups.push(...groups)
    nextToken = response.nextToken
  } while (nextToken && allGroups.length < MAX_LOG_GROUPS)

  // Sort alphabetically by name and enforce the cap
  return allGroups
    .slice(0, MAX_LOG_GROUPS)
    .sort((a, b) => (a.logGroupName ?? '').localeCompare(b.logGroupName ?? ''))
}
