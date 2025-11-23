import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || '';

export const handler = async(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {const connectionId = event.requestContext.connectionId;

    if(!connectionId) {
        return {statusCode: 400, body: 'Missing connection ID'};
    }

    try {
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                connectionId: connectionId,
                connectedAt: Date.now(),
                ttl: Math.floor((Date.now()/1000) + 3600)
            }
        }));
        return {statusCode: 200, body: 'Connected'};
    } catch (error){
        console.error('Error storing connection: ', error);
        return {statusCode: 500, body: 'Failed to connect'};
    }
}