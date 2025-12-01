import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockAgentRuntimeClient, InvokeAgentCommand, InvokeAgentCommandOutput } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockAgentClient, CreateAgentCommand, CreateAgentAliasCommand, PrepareAgentCommand, AgentAlias } from "@aws-sdk/client-bedrock-agent";
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand, ResponseStream } from '@aws-sdk/client-bedrock-runtime';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { json } from 'stream/consumers';
import { CreateSessionCommand } from '@aws-sdk/client-bedrock-agent-runtime';

// Declare the model being used and its ID
const modelID = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
const agentID = process.env.AGENT_ID || ''
const agentAliasID = process.env.AGENT_ALIAS_ID || ''

// Extract body from apigateway event and parse into strings
export const handler = async(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const connectionId = event.requestContext.connectionId;
    const body = JSON.parse(event.body || '{}');
    const userMessage = body.message;

    const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
    const agentClient = new BedrockAgentClient({ region: process.env.AWS_REGION });
    const agentRuntime = new BedrockAgentRuntimeClient({ region: process.env.AWS_REGION })

    const apigatewayClient = new ApiGatewayManagementApiClient({
        endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`
    });

    const command = new InvokeAgentCommand({
        agentId: agentID,
        agentAliasId: agentAliasID,
        sessionId: connectionId,
        inputText: userMessage
    })

    const response: InvokeAgentCommandOutput = await agentRuntime.send(command)

    if (response.completion){
        for await (const event of response.completion) {
            if (event.chunk && event.chunk?.bytes) {
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


