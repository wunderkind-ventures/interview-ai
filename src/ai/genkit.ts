import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { defineGetTechnologyBriefTool } from './tools/technology-tools';
import { defineFindRelevantAssessmentsTool } from './tools/assessment-retrieval-tool';

// Get the Google Cloud project from environment variable
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

// Global Genkit instance with explicit project configuration
export const ai = genkit({
  plugins: [googleAI({
    projectId: projectId,
  })],
});

// Define tools on the global instance and export their references
export const getTechnologyBriefTool = await defineGetTechnologyBriefTool(ai);
export const findRelevantAssessmentsTool = await defineFindRelevantAssessmentsTool(ai);
