import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand, ResponseStream } from '@aws-sdk/client-bedrock-runtime';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { json } from 'stream/consumers';

// Declare the model being used and its ID
const modelID = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
// Extract body from apigateway event and parse into strings
export const handler = async(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const connectionId = event.requestContext.connectionId;
    const body = JSON.parse(event.body || '{}');
    const userMessage = body.message;

    const bedrockClient = new BedrockRuntimeClient({region: process.env.AWS_REGION});
    const apigatewayClient = new ApiGatewayManagementApiClient({endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`
    });

    const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 2000,
    messages: [{ role: "user", content: userMessage }]
    };

    const command = new InvokeModelWithResponseStreamCommand({
        modelId: modelID,
        body: JSON.stringify(payload)
    });

    const response = await bedrockClient.send(command);

    // 6. Loop through chunks and send each back via WebSocket
    if (response.body){
        for await (const event of response.body) {
            if (event.chunk?.bytes) {
                const chunkText = new TextDecoder().decode(event.chunk.bytes);

                const chunkJson = JSON.parse(chunkText);

                if (chunkJson.type == 'content_block_delta' && chunkJson.delta?.text) {
                    const textChunk = chunkJson.delta.text;

                    await apigatewayClient.send(new PostToConnectionCommand({
                        ConnectionId: connectionId,
                        Data: JSON.stringify({
                            type: 'chunk',
                            content: textChunk
                        })
                    }));
                }

                if (chunkJson.type == 'message_stop') {
                    await apigatewayClient.send(new PostToConnectionCommand({
                        ConnectionId: connectionId,
                        Data: JSON.stringify({type: 'done'})
                    }));
                }
            }
        }
    }

    return { statusCode: 200, body: 'Done' };
};


