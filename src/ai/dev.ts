
import { config } from 'dotenv';
config();

import '@/ai/flows/customize-interview-questions.ts';
import '@/ai/flows/summarize-resume.ts';
import '@/ai/flows/generate-interview-feedback.ts';
import '@/ai/flows/generate-deep-dive-feedback.ts';
import '@/ai/flows/generate-take-home-assignment.ts';
import '@/ai/flows/generate-case-study-questions.ts'; // Added new case study flow
import '@/ai/flows/refine-interview-feedback.ts'; // Added new refinement flow
import '@/ai/tools/technology-tools.ts';

