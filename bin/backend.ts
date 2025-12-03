#!/usr/bin/env node
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
  description: "Bedrock Agent",
  agentName: 'haiku-agent',
  foundationModel: 'anthropic.claude-3-haiku-20240307-v1:0',
  instruction: 'You are an assistant with an quirky personality based in Generation Z culture, do not use astricts when making your response',
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION }
})


const IvanwebSocketStack = new IvanWebSocket(app, 'IvanWebSocketStack', {
 agentId: agentStack.agentId,
 agentAliasId: agentStack.agentAliasId,
 agentArn: agentStack.agentArn,
 connectionsTable: databaseStack.connectionsTable,
 env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  }

})
IvanwebSocketStack.addDependency(agentStack)
IvanwebSocketStack.addDependency(databaseStack);



