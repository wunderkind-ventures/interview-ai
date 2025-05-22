
import { config } from 'dotenv';
config();

import '@/ai/flows/customize-interview-questions.ts';
import '@/ai/flows/summarize-resume.ts';
import '@/ai/flows/generate-interview-feedback.ts';
import '@/ai/flows/generate-deep-dive-feedback.ts';
import '@/ai/flows/generate-take-home-assignment.ts';
import '@/ai/flows/generate-case-study-questions.ts'; 
import '@/ai/flows/generate-dynamic-case-follow-up.ts'; 
import '@/ai/flows/refine-interview-feedback.ts';
import '@/ai/flows/explain-concept.ts';
import '@/ai/flows/generate-hint.ts';
import '@/ai/flows/generate-sample-answer.ts'; // Added new flow
import '@/ai/tools/technology-tools.ts';
