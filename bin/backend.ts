#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { IvanDatabaseStack } from '../lib/database-stack';
import {IvanWebSocket} from '../lib/web-socket-stack';
import { IvanAgentStack } from '../lib/agent-stack';
import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';

const app = new cdk.App();

const databaseStack = new IvanDatabaseStack(app, 'IvanDatabaseStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION }
});

// foundationModel is hardcoded in agent-stack.ts
const agentStack = new IvanAgentStack(app, 'IvanAgentStack' , {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION },
  description: "Bedrock Agent",
  agentName: 'Test Agent',
  foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
  instruction: 'You are an assistant with an quirky personality based in Generation Z culture'
})


const IvanwebSocketStack = new IvanWebSocket(app, 'IvanWebSocketStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
 agentId: agentStack.agentId,
 agentAliasId: agentStack.agentAliasId,
 agentArn: agentStack.agentArn,
 connectionsTable: databaseStack.connectionsTable

})

IvanwebSocketStack.addDependency(databaseStack);
IvanwebSocketStack.addDependency(agentStack)
