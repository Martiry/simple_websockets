import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import { WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2';
import * as path from 'path';
import * as bedrock from '@aws-cdk/aws-bedrock-alpha'

interface IvanWebSocketStackProps extends cdk.StackProps {
    connectionsTable: dynamodb.Table;
    agentId: string;
    agentAliasId: string;
    agentArn: string;
    
}

export class IvanWebSocket extends cdk.Stack {
    public readonly webSocketUrl: string;
    public readonly webSocketApiId: string;

    constructor(scope: Construct, id: string, props: IvanWebSocketStackProps) {
        super(scope, id, props);

        const table = props.connectionsTable;

        const webSocketApi = new apigatewayv2.WebSocketApi(this, 'IvansChatWebSocketApi', {
            apiName: 'IvansChatWebSocketApi',
            routeSelectionExpression: '$request.body.action',
        });

        // Create connect lambda and add route
        const connect = new lambda.Function(this, 'ivanConnectFunc', {
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
        const disconnect = new lambda.Function(this, 'ivanDisconnectFunc', {
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

        const foundation = bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_HAIKU_V1_0;

        // Create message sending lambda and add route
        const message = new lambda.Function(this, 'ivanSendMsgFunc', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/send-message')),
            timeout: cdk.Duration.seconds(60),
            memorySize: 512,
            environment: {
                TABLE_NAME: table.tableName,
                BEDROCK_MODEL_ID: foundation.modelId,
                AGENT_ID: props.agentId,
                AGENT_ALIAS_ID: props.agentAliasId
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
        const errorHandler = new lambda.Function(this, 'ivanErrHndlFunc', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/default'))
        });

        webSocketApi.addRoute('$default', {
            integration: new WebSocketLambdaIntegration('DefaultIntegration', errorHandler)
        });

        // Grant Bedrock permissions for agent invocation
        message.addToRolePolicy(new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        "bedrock:InvokeAgent",
        "execute-api:ManageConnections"
    ],
    resources: [
        `arn:aws:bedrock:${this.region}:${this.account}:agent-alias/${props.agentId}/${props.agentAliasId}`,
        `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.apiId}/*`
    ]
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

        this.webSocketUrl = stage.url;
        this.webSocketApiId = webSocketApi.apiId;

        new cdk.CfnOutput(this, 'WebSocketURL', {
            value: stage.url,
            description: 'WebSocket API URL'
        });
    }
}