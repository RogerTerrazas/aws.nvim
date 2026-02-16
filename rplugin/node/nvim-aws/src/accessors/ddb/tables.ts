import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb'

export async function listDynamoDBTables(): Promise<string[] | undefined> {
  const config = {} // type is DynamoDBClientConfig
  const client = new DynamoDBClient(config)
  const command = new ListTablesCommand()
  const response = await client.send(command)

  return response.TableNames
}
