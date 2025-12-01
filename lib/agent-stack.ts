import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as bedrock from '@aws-cdk/aws-bedrock-alpha'
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

    const foundation = bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_HAIKU_V1_0;

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
        resources: [`arn:aws:bedrock:${this.region}::foundation-model/${foundation.modelId}`],
      })
    );
    

    const agent = new bedrock.Agent(this, 'IvansAgent', {
      agentName: props?.agentName || 'ivans-agent',
      foundationModel: foundation,
      instruction: props?.instruction || 'You are an overworked assistant short on time.',
      existingRole: agentRole
      
    });

    const agentAlias = new bedrock.AgentAlias(this, 'AgentAlias', {
      agent: agent,
      agentAliasName: 'dev',
      description: 'Alias for agent' 

    })

    this.agentId = agent.agentId
    this.agentAliasId = agentAlias.aliasId
    this.agentArn = agent.agentArn
 }
}