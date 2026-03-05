import { ListTablesCommand } from '@aws-sdk/client-dynamodb'
import { createDynamoDBClient } from '../../session/index'

export async function listDynamoDBTables(): Promise<string[] | undefined> {
  const client = createDynamoDBClient()
  const command = new ListTablesCommand()
  const response = await client.send(command)

  return response.TableNames
}
