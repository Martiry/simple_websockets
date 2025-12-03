import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface BedrockAgentStackProps extends cdk.StackProps {
  agentName?: string;
  foundationModel?: string;
  instruction?: string;
}

export class IvanAgentStack extends cdk.Stack {
  public readonly agentId: string
  public readonly agentAliasId: string
  public readonly agentArn: string

  constructor(scope: Construct, id: string, props?: BedrockAgentStackProps) {
    super(scope, id, props);

    // Claude 3 Haiku - lightweight and fast
    const foundationModelId = 'anthropic.claude-3-haiku-20240307-v1:0';

    const agentRole = new iam.Role(this, 'AgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Role assumed by Bedrock Agent',
    });

    agentRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: [
          'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0',
        ],
      })
    );

    // Use CfnAgent directly
    const cfnAgent = new bedrock.CfnAgent(this, 'IvansAgent', {
      agentName: (props?.agentName || 'ivans-agent').replace(/\s+/g, '-').toLowerCase(),
      foundationModel: foundationModelId,
      instruction: props?.instruction || 'You are an assistant with an quirky personality based in Generation Z culture',
      agentResourceRoleArn: agentRole.roleArn,
      idleSessionTtlInSeconds: 600,
      autoPrepare: false,
      orchestrationType: 'DEFAULT',
    });

    // Create agent alias
    const cfnAgentAlias = new bedrock.CfnAgentAlias(this, 'AgentAlias', {
      agentId: cfnAgent.attrAgentId,
      agentAliasName: 'dev',
      description: 'Alias for agent'
    });

    this.agentId = cfnAgent.attrAgentId;
    this.agentAliasId = cfnAgentAlias.attrAgentAliasId;
    this.agentArn = cfnAgent.attrAgentArn;

    new cdk.CfnOutput(this, 'AgentId', {
      value: this.agentId,
      exportName: 'IvanAgentId'
    });

    new cdk.CfnOutput(this, 'AgentAliasId', {
      value: this.agentAliasId,
      exportName: 'IvanAgentAliasId'
    });

    new cdk.CfnOutput(this, 'AgentArn', {
      value: this.agentArn,
      exportName: 'IvanAgentArn'
    });
  }
}