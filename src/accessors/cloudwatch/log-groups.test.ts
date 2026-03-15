import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
} from '@aws-sdk/client-cloudwatch-logs'
import { mockClient } from 'aws-sdk-client-mock'
import { beforeEach, describe, expect, it } from 'vitest'
import { listLogGroups } from './log-groups.js'

const cwMock = mockClient(CloudWatchLogsClient)

describe('listLogGroups', () => {
  beforeEach(() => {
    cwMock.reset()
  })

  describe('SUCCESS cases', () => {
    it('should return log groups sorted alphabetically', async () => {
      cwMock.on(DescribeLogGroupsCommand).resolves({
        logGroups: [
          { logGroupName: '/aws/lambda/z-function' },
          { logGroupName: '/aws/lambda/a-function' },
          { logGroupName: '/aws/lambda/m-function' },
        ],
      })

      const result = await listLogGroups()

      expect(result.map((g) => g.logGroupName)).toEqual([
        '/aws/lambda/a-function',
        '/aws/lambda/m-function',
        '/aws/lambda/z-function',
      ])
    })

    it('should return empty array when no log groups exist', async () => {
      cwMock.on(DescribeLogGroupsCommand).resolves({ logGroups: [] })

      const result = await listLogGroups()

      expect(result).toEqual([])
    })

    it('should pass prefix filter to the API', async () => {
      cwMock.on(DescribeLogGroupsCommand).resolves({
        logGroups: [{ logGroupName: '/aws/lambda/my-fn' }],
      })

      await listLogGroups('/aws/lambda')

      expect(cwMock.calls()).toHaveLength(1)
      expect(cwMock.call(0).args[0].input).toMatchObject({
        logGroupNamePrefix: '/aws/lambda',
      })
    })

    it('should paginate across multiple pages', async () => {
      cwMock
        .on(DescribeLogGroupsCommand)
        .resolvesOnce({
          logGroups: [
            { logGroupName: '/aws/lambda/fn-1' },
            { logGroupName: '/aws/lambda/fn-2' },
          ],
          nextToken: 'token-page-2',
        })
        .resolvesOnce({
          logGroups: [{ logGroupName: '/aws/lambda/fn-3' }],
        })

      const result = await listLogGroups()

      expect(result).toHaveLength(3)
      expect(cwMock.calls()).toHaveLength(2)
    })

    it('should cap results at 150 log groups', async () => {
      const manyGroups = Array.from({ length: 160 }, (_, i) => ({
        logGroupName: `/group/${String(i).padStart(3, '0')}`,
      }))

      // Simulate multiple pages that exceed the cap
      cwMock
        .on(DescribeLogGroupsCommand)
        .resolvesOnce({
          logGroups: manyGroups.slice(0, 50),
          nextToken: 'token-2',
        })
        .resolvesOnce({
          logGroups: manyGroups.slice(50, 100),
          nextToken: 'token-3',
        })
        .resolvesOnce({
          logGroups: manyGroups.slice(100, 160),
        })

      const result = await listLogGroups()

      expect(result).toHaveLength(150)
    })

    it('should handle missing logGroups field in response', async () => {
      cwMock.on(DescribeLogGroupsCommand).resolves({})

      const result = await listLogGroups()

      expect(result).toEqual([])
    })
  })

  describe('ERROR cases', () => {
    it('should throw when the API call fails', async () => {
      cwMock
        .on(DescribeLogGroupsCommand)
        .rejects(new Error('AccessDeniedException'))

      await expect(listLogGroups()).rejects.toThrow('AccessDeniedException')
    })
  })
})
