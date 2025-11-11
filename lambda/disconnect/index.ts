import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId;

  if (!connectionId) {
    return { statusCode: 400, body: 'Missing connectionId' };
  }

  try {
    // Remove the connection from DynamoDB
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        connectionId: connectionId
      }
    }));

    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    console.error('Error removing connection:', error);
    return { statusCode: 500, body: 'Failed to disconnect' };
  }
};