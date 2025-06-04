// src/app/api/execute-flow/[flowName]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { genkit, GenkitError } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit'; // Global instance for model name reference

// Import all your top-level flow functions
// This list needs to be comprehensive for all flows the Go backend might call.
import { customizeInterviewQuestions } from '@/ai/flows/customize-interview-questions';
import { generateInterviewFeedback } from '@/ai/flows/generate-interview-feedback';
import { generateDeepDiveFeedback } from '@/ai/flows/generate-deep-dive-feedback';
import { generateTakeHomeAssignment } from '@/ai/flows/generate-take-home-assignment';
import { generateInitialCaseSetup } from '@/ai/flows/generate-case-study-questions';
import { generateDynamicCaseFollowUp } from '@/ai/flows/generate-dynamic-case-follow-up';
import { refineInterviewFeedback } from '@/ai/flows/refine-interview-feedback';
import { explainConcept } from '@/ai/flows/explain-concept';
import { generateHint } from '@/ai/flows/generate-hint';
import { generateSampleAnswer } from '@/ai/flows/generate-sample-answer';
import { getAchievementComponentGuidance } from '@/ai/flows/get-achievement-component-guidance';
import { clarifyFeedback } from '@/ai/flows/clarify-feedback';
import { analyzeResumeStandalone } from '@/ai/flows/analyze-resume-standalone';
import { tailorResumeForJD } from '@/ai/flows/tailor-resume-for-jd';
import { generateCoverLetter } from '@/ai/flows/generate-cover-letter';
import { clarifyInterviewQuestion } from '@/ai/flows/clarify-interview-question';
import { analyzeTakeHomeSubmission } from '@/ai/flows/analyze-take-home-submission';
// Add other flow imports here... summarizeResume is usually very simple, maybe keep client side or handle as well

// A map to easily access flow functions by name
const flowMap: Record<string, Function> = {
  customizeInterviewQuestions,
  generateInterviewFeedback,
  generateDeepDiveFeedback,
  generateTakeHomeAssignment,
  generateInitialCaseSetup,
  generateDynamicCaseFollowUp,
  refineInterviewFeedback,
  explainConcept,
  generateHint,
  generateSampleAnswer,
  getAchievementComponentGuidance,
  clarifyFeedback,
  analyzeResumeStandalone,
  tailorResumeForJD,
  generateCoverLetter,
  clarifyInterviewQuestion,
  analyzeTakeHomeSubmission,
  // Add other flow function names and their imports here
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ flowName: string }> }
) {
  const params = await context.params;
  const { flowName } = params;
  const apiKey = req.headers.get('X-Internal-API-Key');
  const apiKeySource = req.headers.get('X-API-Key-Source'); // For logging, sent by Go backend

  if (!apiKey) {
    console.error(`[API Execute Flow] Error: API key missing in internal call for flow: ${flowName}`);
    return NextResponse.json({ error: 'API key missing in internal call' }, { status: 400 });
  }

  const flowToExecute = flowMap[flowName];
  if (!flowToExecute) {
    console.error(`[API Execute Flow] Error: Flow ${flowName} not found in flowMap.`);
    return NextResponse.json({ error: `Flow ${flowName} not found` }, { status: 404 });
  }

  try {
    const requestBody = await req.json();
    console.log(`[API Execute Flow] Executing flow: ${flowName} with API key from source: ${apiKeySource}`);

    // The flow function itself will handle creating a dynamic Genkit instance with the apiKey
    const result = await flowToExecute(requestBody, { apiKey });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[API Execute Flow] Error executing flow ${flowName}:`, error);
    let errorMessage = 'Failed to execute AI flow';
    let errorDetails = error.message;
    if (error instanceof GenkitError) {
        errorMessage = error.message; // GenkitError often has a user-friendly message
        errorDetails = JSON.stringify(error.detail || error.cause || error.stack); // Try error.detail (singular)
    }
    return NextResponse.json({ error: errorMessage, details: errorDetails }, { status: 500 });
  }
}
