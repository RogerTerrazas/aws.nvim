import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb'
import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { DynamoDBItem } from './items'

export type SkOperator =
  | '='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'begins_with'
  | 'between'

export interface SkCondition {
  operator: SkOperator
  value: string
  value2?: string // only used for 'between'
}

export interface QueryParams {
  tableName: string
  indexName?: string
  partitionKeyName: string
  partitionKeyValue: string
  partitionKeyType: string // S | N | B
  sortKeyName?: string
  sortKeyCondition?: SkCondition
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

  const { sortKeyName, sortKeyCondition, sortKeyType } = params

  if (sortKeyName && sortKeyCondition && sortKeyType) {
    expressionNames['#sk'] = sortKeyName
    const { operator, value, value2 } = sortKeyCondition

    if (operator === 'between') {
      expressionValues[':sk1'] = marshalValue(value, sortKeyType)
      expressionValues[':sk2'] = marshalValue(value2 ?? value, sortKeyType)
      keyConditionExpression += ' AND #sk BETWEEN :sk1 AND :sk2'
    } else if (operator === 'begins_with') {
      expressionValues[':sk'] = marshalValue(value, sortKeyType)
      keyConditionExpression += ' AND begins_with(#sk, :sk)'
    } else {
      // =, <, <=, >, >=
      expressionValues[':sk'] = marshalValue(value, sortKeyType)
      keyConditionExpression += ` AND #sk ${operator} :sk`
    }
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
