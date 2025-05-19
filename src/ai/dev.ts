
import { config } from 'dotenv';
config();

import '@/ai/flows/customize-interview-questions.ts';
import '@/ai/flows/summarize-resume.ts';
import '@/ai/flows/generate-interview-feedback.ts';
import '@/ai/flows/generate-deep-dive-feedback.ts';
import '@/ai/flows/generate-take-home-assignment.ts';
import '@/ai/flows/generate-case-study-questions.ts'; // Renamed from generate-case-study-questions to generateInitialCaseSetup if that was the intent
import '@/ai/flows/generate-dynamic-case-follow-up.ts'; // Added new dynamic follow-up flow
import '@/ai/flows/refine-interview-feedback.ts';
import '@/ai/tools/technology-tools.ts';

