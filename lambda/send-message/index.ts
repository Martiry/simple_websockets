import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockAgentRuntimeClient, InvokeAgentCommand, InvokeAgentCommandOutput } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockAgentClient, CreateAgentCommand, CreateAgentAliasCommand, PrepareAgentCommand, AgentAlias } from "@aws-sdk/client-bedrock-agent";
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand, ResponseStream } from '@aws-sdk/client-bedrock-runtime';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { json } from 'stream/consumers';
import { CreateSessionCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { createHash } from 'crypto';

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
    })


    const command = new InvokeAgentCommand({
        agentId: agentID,
        agentAliasId: agentAliasID,
        sessionId: "session-1",
        inputText: userMessage
    })

    const response: InvokeAgentCommandOutput = await agentRuntime.send(command)

    if (response.completion) {
      let fullText = '';
      
      for await (const chunkEvent of response.completion) {
        try {
          if (chunkEvent.chunk && chunkEvent.chunk?.bytes) {
            const chunkBytes = chunkEvent.chunk.bytes;
            const chunkText = new TextDecoder().decode(chunkBytes);
            
            console.log('Decoded chunk:', chunkText);
            
            // Try to parse as JSON first
            try {
              const chunkJson = JSON.parse(chunkText);
              
              // Handle content blocks
              if (chunkJson.type === 'content_block_delta' && chunkJson.delta?.type === 'text_delta') {
                const textDelta = chunkJson.delta.text;
                fullText += textDelta;
                
                // Send text to WebSocket
                await apigatewayClient.send(new PostToConnectionCommand({
                  ConnectionId: connectionId,
                  Data: JSON.stringify({
                    type: 'chunk',
                    content: textDelta
                  })
                }));
              }
              
              // Handle message stop
              if (chunkJson.type === 'message_stop') {
                console.log('Message stop received');
                await apigatewayClient.send(new PostToConnectionCommand({
                  ConnectionId: connectionId,
                  Data: JSON.stringify({ type: 'done' })
                }));
                break;
              }
            } catch (jsonError) {
              // If not JSON, treat as raw text content
              console.log('Raw text chunk received (not JSON)');
              
              // Remove asterisks and action text like *clears throat*
              let cleanText = chunkText.replace(/\*[^*]*\*/g, '').trim();
              
              if (cleanText) {
                fullText += cleanText;
                
                // Send to WebSocket
                await apigatewayClient.send(new PostToConnectionCommand({
                  ConnectionId: connectionId,
                  Data: JSON.stringify({
                    type: 'chunk',
                    content: cleanText
                  })
                }));
              }
            }
          }
        } catch (chunkError) {
          console.error('Error processing chunk:', chunkError);
          // Continue to next chunk
        }
      }
      
      console.log('Final response:', fullText.substring(0, 100));
    }

    return { statusCode: 200, body: 'Done' };
};


