/**
 * BYOK (Bring Your Own Key) Flows API Client
 * 
 * This module handles API calls to AI flows through the BYOK backend,
 * ensuring proper request formatting to avoid schema validation errors.
 */

import { getAuth } from 'firebase/auth';
import { getApp } from 'firebase/app';

// Import the specific types needed
import type { CustomizeInterviewQuestionsInput, CustomizeInterviewQuestionsOutput } from "@/ai/flows/customize-interview-questions";
import type { GenerateInterviewFeedbackInput, GenerateInterviewFeedbackOutput } from "@/ai/flows/generate-interview-feedback";

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
    throw new Error('[BYOK] Backend URL (NEXT_PUBLIC_GO_BACKEND_URL) is not configured. Cannot execute flow.');
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
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
    
    const response = await fetch(`${GO_BACKEND_URL}/api/ai/genkit/${flowName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    if (!response.ok) {
      let errorResponseMessage = `Flow execution failed with status ${response.status}`;
      try {
        const errorText = await response.text();
        console.error(`[BYOK] Raw error response:`, errorText);
        try {
          const errorData = JSON.parse(errorText);
          console.error(`[BYOK] Flow execution failed JSON data:`, errorData);
          if (errorData && typeof errorData.error === 'string') {
            errorResponseMessage = errorData.error;
            // Check for schema validation errors
            if (errorData.error.includes('Schema validation failed')) {
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
          } else if (errorData && typeof errorData.message === 'string') { // some errors might use message
            errorResponseMessage = errorData.message;
          } else {
             errorResponseMessage = `Flow execution failed: ${errorText || 'No additional error information available.'}`;
          }
        } catch (parseError) {
          console.error('[BYOK] Failed to parse error response as JSON:', parseError);
          errorResponseMessage = `Flow execution failed. Raw response: ${errorText || 'No additional error information available.'}`;
        }
      } catch (textError) {
        console.error('[BYOK] Failed to get error response text:', textError);
        // If getting text fails, we still want to throw the original status-based message.
      }
      throw new Error(errorResponseMessage);
    }

    // Check if response has content
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`[BYOK] Response is not JSON. Content-Type: ${contentType}, Body: ${text}`);
      throw new Error(`Invalid response format from server. Expected JSON but received ${contentType}`);
    }
    
    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      console.error(`[BYOK] Failed to parse JSON response:`, jsonError);
      const text = await response.text();
      console.error(`[BYOK] Response body:`, text);
      throw new Error(`Failed to parse server response. The server may have returned an invalid response.`);
    }
    
    console.log(`[BYOK] Flow ${flowName} executed successfully`);
    console.log(`[BYOK] Response size: ${JSON.stringify(result).length} characters`);
    return result as TOutput;
  } catch (error) {
    console.error(`[BYOK] Error executing flow ${flowName}:`, error);
    
    // Handle timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[BYOK] Request timed out after 2 minutes');
      throw new Error(`Request timed out. The ${flowName} operation is taking longer than expected. Please try again.`);
    }
    
    // Handle network errors
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('[BYOK] Network error - possible CORS issue or backend is unreachable');
      throw new Error(`Network error: Unable to reach the backend service. Please check your connection and try again.`);
    }
    
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
export async function customizeInterviewQuestionsBYOK(input: CustomizeInterviewQuestionsInput): Promise<CustomizeInterviewQuestionsOutput> {
  // Ensure all required fields are properly set according to CustomizeInterviewQuestionsInputSchema
  const sanitizedInput: CustomizeInterviewQuestionsInput = {
    // Fields from CustomizeInterviewQuestionsInputSchema
    interviewType: input.interviewType, // This is required by schema
    interviewStyle: input.interviewStyle, // This is required by schema
    faangLevel: input.faangLevel, // This is required by schema
    
    jobTitle: input.jobTitle || "",
    jobDescription: input.jobDescription || "",
    resume: input.resume || "", // resume is in the schema
    targetCompany: input.targetCompany || "",
    targetedSkills: input.targetedSkills || [],
    interviewFocus: input.interviewFocus || "",
    interviewerPersona: input.interviewerPersona || "neutral", // schema has interviewerPersona
    previousConversation: input.previousConversation || "",
    currentQuestion: input.currentQuestion || "",
    caseStudyNotes: input.caseStudyNotes || "",

    // Fields NOT in CustomizeInterviewQuestionsInputSchema are removed here.
    // If they are needed by the flow, the schema in src/ai/schemas.ts must be updated.
  };

  return executeBYOKFlow<CustomizeInterviewQuestionsInput, CustomizeInterviewQuestionsOutput>('customizeInterviewQuestions', sanitizedInput);
}

/**
 * Wrapper for generateInterviewFeedback that handles BYOK
 */
export async function generateInterviewFeedbackBYOK(input: GenerateInterviewFeedbackInput): Promise<GenerateInterviewFeedbackOutput> {
  return executeBYOKFlow<GenerateInterviewFeedbackInput, GenerateInterviewFeedbackOutput>('generateInterviewFeedback', input);
} 