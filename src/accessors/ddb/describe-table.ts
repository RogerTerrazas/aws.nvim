import type {
  AttributeDefinition,
  KeySchemaElement,
} from '@aws-sdk/client-dynamodb'
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb'
import { createDynamoDBClient } from '../../session/index'

export interface TableKeyAttr {
  name: string
  type: string // S | N | B
}

export interface TableKeySchema {
  partitionKey: TableKeyAttr
  sortKey?: TableKeyAttr
}

export interface TableIndex {
  name: string
  keySchema: TableKeySchema
}

export interface TableDescription {
  tableName: string
  keySchema: TableKeySchema
  globalSecondaryIndexes: TableIndex[]
  localSecondaryIndexes: TableIndex[]
}

function resolveKeySchema(
  keyElements: KeySchemaElement[],
  attrDefs: AttributeDefinition[]
): TableKeySchema {
  const pk = keyElements.find((k) => k.KeyType === 'HASH')
  const sk = keyElements.find((k) => k.KeyType === 'RANGE')

  const attrType = (name: string): string =>
    attrDefs.find((a) => a.AttributeName === name)?.AttributeType ?? 'S'

  return {
    partitionKey: {
      name: pk?.AttributeName ?? '',
      type: attrType(pk?.AttributeName ?? ''),
    },
    ...(sk
      ? {
          sortKey: {
            name: sk.AttributeName ?? '',
            type: attrType(sk.AttributeName ?? ''),
          },
        }
      : {}),
  }
}

export async function describeTable(
  tableName: string
): Promise<TableDescription> {
  const client = createDynamoDBClient()
  const command = new DescribeTableCommand({ TableName: tableName })
  const response = await client.send(command)

  const table =
    response.Table ??
    (() => {
      throw new Error('DescribeTable response missing Table')
    })()
  const attrDefs = table.AttributeDefinitions ?? []
  const keySchema = resolveKeySchema(table.KeySchema ?? [], attrDefs)

  const globalSecondaryIndexes: TableIndex[] = (
    table.GlobalSecondaryIndexes ?? []
  ).map((gsi) => ({
    name: gsi.IndexName ?? '',
    keySchema: resolveKeySchema(gsi.KeySchema ?? [], attrDefs),
  }))

  const localSecondaryIndexes: TableIndex[] = (
    table.LocalSecondaryIndexes ?? []
  ).map((lsi) => ({
    name: lsi.IndexName ?? '',
    keySchema: resolveKeySchema(lsi.KeySchema ?? [], attrDefs),
  }))

  return {
    tableName,
    keySchema,
    globalSecondaryIndexes,
    localSecondaryIndexes,
  }
}
