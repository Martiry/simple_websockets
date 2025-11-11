import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId;

  if (!connectionId) {
    return { statusCode: 400, body: 'Missing connectionId' };
  }

  // Send error message back to client
  const apiGatewayClient = new ApiGatewayManagementApiClient({
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`
  });

  try {
    await apiGatewayClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        type: 'error',
        message: 'Unknown action or invalid request'
      })
    }));

    return { statusCode: 200, body: 'Error sent to client' };
  } catch (error) {
    console.error('Error handling default route:', error);
    return { statusCode: 500, body: 'Failed to handle request' };
  }
};