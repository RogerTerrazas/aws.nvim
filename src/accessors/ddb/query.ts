import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb'
import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { DynamoDBItem } from './items'

export interface QueryParams {
  tableName: string
  indexName?: string
  partitionKeyName: string
  partitionKeyValue: string
  partitionKeyType: string // S | N | B
  sortKeyName?: string
  sortKeyValue?: string
  sortKeyType?: string // S | N | B
  limit: number
}

function marshalValue(value: string, type: string): AttributeValue {
  if (type === 'N') return { N: value }
  if (type === 'B') return { B: Buffer.from(value) }
  return { S: value }
}

export async function queryDynamoDBTable(
  params: QueryParams
): Promise<DynamoDBItem[]> {
  const client = new DynamoDBClient({})

  const expressionNames: Record<string, string> = {
    '#pk': params.partitionKeyName,
  }
  const expressionValues: Record<string, AttributeValue> = {
    ':pk': marshalValue(params.partitionKeyValue, params.partitionKeyType),
  }

  let keyConditionExpression = '#pk = :pk'

  if (params.sortKeyName && params.sortKeyValue && params.sortKeyType) {
    expressionNames['#sk'] = params.sortKeyName
    expressionValues[':sk'] = marshalValue(
      params.sortKeyValue,
      params.sortKeyType
    )
    keyConditionExpression += ' AND #sk = :sk'
  }

  const command = new QueryCommand({
    TableName: params.tableName,
    ...(params.indexName ? { IndexName: params.indexName } : {}),
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    Limit: params.limit,
  })

  const response = await client.send(command)
  return response.Items?.map((item) => unmarshall(item)) ?? []
}
