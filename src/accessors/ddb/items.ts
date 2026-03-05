import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb'
import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'

export interface DynamoDBItem {
  [key: string]: any
}

export interface FilterParams {
  expression: string
  attributeNames: Record<string, string>
  attributeValues: Record<string, AttributeValue>
}

/**
 * Scan a DynamoDB table and return the first N items.
 * An optional filter can be applied via a FilterExpression.
 *
 * @param tableName  The name of the table to scan
 * @param limit      Maximum number of items to return (default: 50)
 * @param filter     Optional FilterExpression with attribute names/values
 */
export async function scanDynamoDBTable(
  tableName: string,
  limit: number = 50,
  filter?: FilterParams
): Promise<DynamoDBItem[]> {
  const client = new DynamoDBClient({})

  const command = new ScanCommand({
    TableName: tableName,
    Limit: limit,
    ...(filter
      ? {
          FilterExpression: filter.expression,
          ExpressionAttributeNames: filter.attributeNames,
          ExpressionAttributeValues: filter.attributeValues,
        }
      : {}),
  })

  const response = await client.send(command)
  return response.Items?.map((item) => unmarshall(item)) ?? []
}
