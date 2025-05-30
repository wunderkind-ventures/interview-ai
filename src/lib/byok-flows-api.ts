/**
 * BYOK (Bring Your Own Key) Flows API Client
 * 
 * This module handles API calls to AI flows through the BYOK backend,
 * ensuring proper request formatting to avoid schema validation errors.
 */

import { getAuth } from 'firebase/auth';
import { getApp } from 'firebase/app';

// Get the backend URL from environment variable
const GO_BACKEND_URL = process.env.NEXT_PUBLIC_GO_BACKEND_URL || '';

interface BYOKFlowOptions {
  useUserApiKey?: boolean;
}

/**
 * Execute an AI flow through the BYOK backend
 * @param flowName The name of the flow to execute
 * @param input The input data for the flow
 * @param options Options for the flow execution
 * @returns The flow result
 */
export async function executeBYOKFlow<TInput, TOutput>(
  flowName: string,
  input: TInput,
  options: BYOKFlowOptions = {}
): Promise<TOutput> {
  // Check if BYOK is enabled
  if (!GO_BACKEND_URL) {
    console.log('[BYOK] No backend URL configured, using direct flow execution');
    // Fall back to direct execution
    const flowModule = await import(`@/ai/flows/${flowName.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
    const flowFunction = flowModule[flowName];
    if (!flowFunction) {
      throw new Error(`Flow ${flowName} not found`);
    }
    return flowFunction(input);
  }

  // Get the current user's auth token
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to execute flows');
  }

  const idToken = await user.getIdToken();

  try {
    console.log(`[BYOK] Executing flow ${flowName} through backend`);
    console.log('[BYOK] Request URL:', `${GO_BACKEND_URL}/api/ai/genkit/${flowName}`);
    console.log('[BYOK] Request body:', JSON.stringify(input, null, 2));
    
    const response = await fetch(`${GO_BACKEND_URL}/api/ai/genkit/${flowName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`[BYOK] Flow execution failed:`, errorData);
      
      // Check for schema validation errors
      if (errorData.error && errorData.error.includes('Schema validation failed')) {
        console.error('[BYOK] Schema validation error detected:', errorData.error);
        // Log the problematic data for debugging
        console.error('[BYOK] Input that caused error:', input);
        
        // Try to parse the error message for more details
        const providedDataMatch = errorData.error.match(/Provided data: ({[\s\S]*?})\s*Required/);
        if (providedDataMatch) {
          try {
            const providedData = JSON.parse(providedDataMatch[1]);
            console.error('[BYOK] Data that Genkit received:', JSON.stringify(providedData, null, 2));
          } catch (e) {
            console.error('[BYOK] Could not parse provided data from error message');
          }
        }
      }
      
      throw new Error(errorData.error || `Flow execution failed with status ${response.status}`);
    }

    const result = await response.json();
    console.log(`[BYOK] Flow ${flowName} executed successfully`);
    return result as TOutput;
  } catch (error) {
    console.error(`[BYOK] Error executing flow ${flowName}:`, error);
    
    // If it's a schema validation error, provide more context
    if (error instanceof Error && error.message.includes('Schema validation failed')) {
      console.error('[BYOK] This is likely due to malformed input data.');
      console.error('[BYOK] Check that all required fields are present and properly typed.');
    }
    
    throw error;
  }
}

/**
 * Check if the user has a custom API key set
 * @returns boolean indicating if user has a custom API key
 */
export async function hasUserApiKey(): Promise<boolean> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user || !GO_BACKEND_URL) {
    return false;
  }

  try {
    const idToken = await user.getIdToken();
    const response = await fetch(`${GO_BACKEND_URL}/api/user/api-key-status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.hasKey === true;
    }
  } catch (error) {
    console.error('[BYOK] Error checking API key status:', error);
  }

  return false;
}

/**
 * Wrapper for customizeInterviewQuestions that handles BYOK
 */
export async function customizeInterviewQuestionsBYOK(input: any) {
  // Ensure all required fields are properly set
  const sanitizedInput = {
    ...input,
    // Ensure these fields are never null/undefined
    previousConversation: input.previousConversation || "",
    currentQuestion: input.currentQuestion || "",
    caseStudyNotes: input.caseStudyNotes || "",
    targetedSkills: input.targetedSkills || [],
    targetCompany: input.targetCompany || "",
    interviewFocus: input.interviewFocus || "",
  };

  return executeBYOKFlow('customizeInterviewQuestions', sanitizedInput);
} 