import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'

export interface DynamoDBItem {
  [key: string]: any
}

/**
 * Scan a DynamoDB table and return the first N items
 * @param tableName The name of the table to scan
 * @param limit Maximum number of items to return (default: 50)
 * @returns Array of unmarshalled items
 */
export async function scanDynamoDBTable(
  tableName: string,
  limit: number = 50
): Promise<DynamoDBItem[]> {
  const config = {} // type is DynamoDBClientConfig
  const client = new DynamoDBClient(config)

  const command = new ScanCommand({
    TableName: tableName,
    Limit: limit,
  })

  const response = await client.send(command)

  // Unmarshall the items to convert DynamoDB format to plain JavaScript objects
  const items = response.Items?.map((item) => unmarshall(item)) || []

  return items
}
