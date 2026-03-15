import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  QueryStatus,
  StartQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs'
import { mockClient } from 'aws-sdk-client-mock'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  pollQueryResults,
  runInsightsQuery,
  startInsightsQuery,
} from './query.js'

// Mock setTimeout so polling tests don't actually wait
vi.useFakeTimers()

const cwMock = mockClient(CloudWatchLogsClient)

const BASE_PARAMS = {
  logGroupNames: ['/aws/lambda/my-fn'],
  queryString: 'filter @message like /error/',
  startTime: 1700000000,
  endTime: 1700003600,
  limit: 100,
}

describe('startInsightsQuery', () => {
  beforeEach(() => {
    cwMock.reset()
  })

  it('should return the queryId from StartQuery', async () => {
    cwMock.on(StartQueryCommand).resolves({ queryId: 'test-query-id-123' })

    const queryId = await startInsightsQuery(BASE_PARAMS)

    expect(queryId).toBe('test-query-id-123')
    expect(cwMock.calls()).toHaveLength(1)
    expect(cwMock.call(0).args[0].input).toMatchObject({
      logGroupNames: ['/aws/lambda/my-fn'],
      queryString: 'filter @message like /error/',
      startTime: 1700000000,
      endTime: 1700003600,
      limit: 100,
    })
  })

  it('should throw if no queryId is returned', async () => {
    cwMock.on(StartQueryCommand).resolves({})

    await expect(startInsightsQuery(BASE_PARAMS)).rejects.toThrow(
      'StartQuery did not return a queryId'
    )
  })

  it('should throw when the API call fails', async () => {
    cwMock.on(StartQueryCommand).rejects(new Error('LimitExceededException'))

    await expect(startInsightsQuery(BASE_PARAMS)).rejects.toThrow(
      'LimitExceededException'
    )
  })
})

describe('pollQueryResults', () => {
  beforeEach(() => {
    cwMock.reset()
    vi.clearAllTimers()
  })

  it('should return results when query is Complete on first poll', async () => {
    cwMock.on(GetQueryResultsCommand).resolves({
      status: QueryStatus.Complete,
      results: [
        [
          { field: '@timestamp', value: '2024-01-15 10:00:00.000' },
          { field: '@message', value: 'Hello world' },
        ],
      ],
      statistics: { recordsMatched: 1, recordsScanned: 100 },
    })

    const promise = pollQueryResults('query-abc')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.status).toBe(QueryStatus.Complete)
    expect(result.results).toHaveLength(1)
    expect(result.results[0]).toEqual({
      '@timestamp': '2024-01-15 10:00:00.000',
      '@message': 'Hello world',
    })
    expect(result.statistics.recordsMatched).toBe(1)
  })

  it('should poll multiple times before completing', async () => {
    cwMock
      .on(GetQueryResultsCommand)
      .resolvesOnce({ status: QueryStatus.Running, results: [] })
      .resolvesOnce({ status: QueryStatus.Running, results: [] })
      .resolvesOnce({
        status: QueryStatus.Complete,
        results: [[{ field: '@message', value: 'done' }]],
        statistics: {},
      })

    const promise = pollQueryResults('query-abc')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.status).toBe(QueryStatus.Complete)
    expect(cwMock.calls()).toHaveLength(3)
  })

  it('should return with Failed status when query fails', async () => {
    cwMock.on(GetQueryResultsCommand).resolves({
      status: QueryStatus.Failed,
      results: [],
      statistics: {},
    })

    const promise = pollQueryResults('query-abc')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.status).toBe(QueryStatus.Failed)
    expect(result.results).toEqual([])
  })

  it('should handle results with missing field values gracefully', async () => {
    cwMock.on(GetQueryResultsCommand).resolves({
      status: QueryStatus.Complete,
      results: [
        [
          { field: '@message' }, // no value
          { field: '@timestamp', value: '2024-01-01' },
        ],
      ],
      statistics: {},
    })

    const promise = pollQueryResults('query-abc')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.results[0]).toEqual({
      '@message': '',
      '@timestamp': '2024-01-01',
    })
  })
})

describe('runInsightsQuery', () => {
  beforeEach(() => {
    cwMock.reset()
    vi.clearAllTimers()
  })

  it('should start query and return polled results', async () => {
    cwMock.on(StartQueryCommand).resolves({ queryId: 'run-query-id' })
    cwMock.on(GetQueryResultsCommand).resolves({
      status: QueryStatus.Complete,
      results: [[{ field: '@message', value: 'log line' }]],
      statistics: { recordsMatched: 1 },
    })

    const promise = runInsightsQuery(BASE_PARAMS)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.status).toBe(QueryStatus.Complete)
    expect(result.results[0]).toEqual({ '@message': 'log line' })
  })
})
