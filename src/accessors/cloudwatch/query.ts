import {
  GetQueryResultsCommand,
  type QueryStatistics,
  QueryStatus,
  type ResultField,
  StartQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs'
import { createCloudWatchLogsClient } from '../../session/index'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface InsightsQueryParams {
  /** Log group names to query (max 50 per AWS limit). */
  logGroupNames: string[]
  /** CloudWatch Logs Insights query string. */
  queryString: string
  /** Query start time as Unix epoch seconds. */
  startTime: number
  /** Query end time as Unix epoch seconds. */
  endTime: number
  /** Maximum number of results to return (1–10000). */
  limit: number
}

/** A single log event returned by a Logs Insights query. */
export type InsightsResult = Record<string, string>

export interface InsightsQueryResponse {
  results: InsightsResult[]
  status: string
  statistics: QueryStatistics
}

// ---------------------------------------------------------------------------
// Polling configuration
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 500
const MAX_POLL_ATTEMPTS = 120 // 120 × 500ms = 60s max wait

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resultFieldsToRecord(fields: ResultField[]): InsightsResult {
  const record: InsightsResult = {}
  for (const { field, value } of fields) {
    if (field !== undefined) {
      record[field] = value ?? ''
    }
  }
  return record
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Accessor functions
// ---------------------------------------------------------------------------

/**
 * Start a CloudWatch Logs Insights query and return the queryId.
 */
export async function startInsightsQuery(
  params: InsightsQueryParams
): Promise<string> {
  const client = createCloudWatchLogsClient()

  const command = new StartQueryCommand({
    logGroupNames: params.logGroupNames,
    queryString: params.queryString,
    startTime: params.startTime,
    endTime: params.endTime,
    limit: params.limit,
  })

  const response = await client.send(command)

  if (!response.queryId) {
    throw new Error('StartQuery did not return a queryId')
  }

  return response.queryId
}

/**
 * Poll GetQueryResults until the query reaches a terminal state.
 *
 * Terminal states: Complete, Failed, Cancelled, Timeout
 * Polls every POLL_INTERVAL_MS ms for up to MAX_POLL_ATTEMPTS attempts.
 */
export async function pollQueryResults(
  queryId: string
): Promise<InsightsQueryResponse> {
  const client = createCloudWatchLogsClient()

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const command = new GetQueryResultsCommand({ queryId })
    const response = await client.send(command)

    const status = response.status ?? QueryStatus.Unknown

    const isTerminal =
      status === QueryStatus.Complete ||
      status === QueryStatus.Failed ||
      status === QueryStatus.Cancelled ||
      status === QueryStatus.Timeout

    if (isTerminal) {
      const results = (response.results ?? []).map((fields) =>
        resultFieldsToRecord(fields)
      )
      return {
        results,
        status,
        statistics: response.statistics ?? {},
      }
    }

    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error(
    `Query ${queryId} did not complete within ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`
  )
}

/**
 * Run a CloudWatch Logs Insights query end-to-end:
 * starts the query and polls until it reaches a terminal state.
 */
export async function runInsightsQuery(
  params: InsightsQueryParams
): Promise<InsightsQueryResponse> {
  const queryId = await startInsightsQuery(params)
  return pollQueryResults(queryId)
}
