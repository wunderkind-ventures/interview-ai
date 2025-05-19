
import { config } from 'dotenv';
config();

import '@/ai/flows/customize-interview-questions.ts';
import '@/ai/flows/summarize-resume.ts';
import '@/ai/flows/generate-interview-feedback.ts'; // Added new flow
import '@/ai/tools/technology-tools.ts'; // Added new tools
