#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import {WebSocket} from '../lib/web-socket-stack';

const app = new cdk.App();

const databaseStack = new DatabaseStack(app, 'DatabaseStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION }
});

const webSocketStack = new WebSocket(app, 'WebSocketStack', {
  connectionsTable: databaseStack.connectionsTable, 
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION } });

webSocketStack.addDependency(databaseStack);
