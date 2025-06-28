/**
 * OpenTelemetry configuration for Google Cloud Trace integration
 * This file should be imported at the very beginning of the application
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Only initialize if not already configured by Genkit
if (!process.env.OTEL_SDK_DISABLED) {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'interview-ai-agents',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'interview-ai',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      
      // Custom attributes for our multi-agent system
      'agent.system.type': 'multi-agent',
      'agent.system.orchestrator': 'genkit',
      'agent.system.complexity.adaptive': 'true'
    }),
    
    // Let Genkit handle the instrumentation and exporters
    autoDetectResources: true,
  });

  // Initialize the SDK
  sdk.start();
  
  console.log('OpenTelemetry initialized for Interview AI agents');
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('OpenTelemetry terminated'))
      .catch((error) => console.log('Error terminating OpenTelemetry', error))
      .finally(() => process.exit(0));
  });
}

export default {};