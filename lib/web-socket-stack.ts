import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import { WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2';
import * as path from 'path';

interface WebSocketStackProps extends cdk.StackProps {
    connectionsTable: dynamodb.Table;
}

export class WebSocket extends cdk.Stack {
    constructor(scope: Construct, id: string, props: WebSocketStackProps) {
        super(scope, id, props);

        const table = props.connectionsTable;

        const webSocketApi = new apigatewayv2.WebSocketApi(this, 'RyansChatWebSocketApi', {
            apiName: 'RyansChatWebSocketApi',
            routeSelectionExpression: '$request.body.action',
        });

        // Create connect lambda and add route
        const connect = new lambda.Function(this, 'ryanConnectFunc', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/connect')),
            environment: {
                TABLE_NAME: table.tableName
            }
        });

        webSocketApi.addRoute('$connect', {
            integration: new WebSocketLambdaIntegration('ConnectIntegration', connect)
        });

        // create disconnect lambda and add route
        const disconnect = new lambda.Function(this, 'ryanDisconnectFunc', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/disconnect')),
            environment: {
                TABLE_NAME: table.tableName
            }
        });

        webSocketApi.addRoute('$disconnect', {
            integration: new WebSocketLambdaIntegration('DisconnectIntegration', disconnect)
        });

        // Create message sending lambda and add route
        const message = new lambda.Function(this, 'ryanSendMsgFunc', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/send-message')),
            environment: {
                TABLE_NAME: table.tableName,
                BEDROCK_MODEL_ID: 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
            }
        });

        webSocketApi.addRoute('sendMessage', {
            integration: new WebSocketLambdaIntegration('MessageIntegration', message)
        });

        // Grant specific table access to each lambda
        table.grant(connect, 'dynamodb:GetItem', 'dynamodb:PutItem');
        table.grant(disconnect, 'dynamodb:DeleteItem');
        table.grant(message, 'dynamodb:GetItem', 'dynamodb:PutItem');

        // Create error handling lambda and add route
        const errorHandler = new lambda.Function(this, 'ryanErrHndlFunc', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/default'))
        });

        webSocketApi.addRoute('$default', {
            integration: new WebSocketLambdaIntegration('DefaultIntegration', errorHandler)
        });

        // Grant Bedrock permissions
        message.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['bedrock:InvokeModelWithResponseStream'],
            resources: [
                // Set region to be agnostic since to acount for routing
                'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0',
                `arn:aws:bedrock:*:${this.account}:inference-profile/us.anthropic.claude-3-5-haiku-20241022-v1:0`
            ]
        }));


        // Grant API Gateway management permissions
        message.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['execute-api:ManageConnections'],
            resources: [`arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.apiId}/*`]
        }));

        errorHandler.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['execute-api:ManageConnections'],
            resources: [`arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.apiId}/*`]
        }));

        const stage = new WebSocketStage(this, 'ProdStage', {
            webSocketApi: webSocketApi,
            stageName: 'dev',
            autoDeploy: true
        });

        new cdk.CfnOutput(this, 'WebSocketURL', {
            value: stage.url,
            description: 'WebSocket API URL'
        });
    }
}