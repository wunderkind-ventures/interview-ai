
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
import '@/ai/flows/generate-sample-answer.ts';
import '@/ai/flows/get-achievement-component-guidance.ts';
import '@/ai/flows/clarify-feedback.ts';
import '@/ai/flows/analyze-resume-standalone.ts'; // New flow for standalone resume analysis
import '@/ai/flows/tailor-resume-for-jd.ts'; // New flow for resume tailoring to JD
import '@/ai/tools/technology-tools.ts';
