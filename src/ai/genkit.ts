import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { defineGetTechnologyBriefTool } from './tools/technology-tools';
import { defineFindRelevantAssessmentsTool } from './tools/assessment-retrieval-tool';

// Global Genkit instance
export const ai = genkit({
  plugins: [googleAI()],
});

// Define tools on the global instance and export their references
export const getTechnologyBriefTool = await defineGetTechnologyBriefTool(ai);
export const findRelevantAssessmentsTool = await defineFindRelevantAssessmentsTool(ai);
