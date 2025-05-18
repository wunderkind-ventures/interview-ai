export const INTERVIEW_TYPES = [
  { value: "product sense", label: "Product Sense" },
  { value: "technical system design", label: "Technical System Design" },
  { value: "behavioral", label: "Behavioral" },
] as const;

export type InterviewType = typeof INTERVIEW_TYPES[number]['value'];

export const FAANG_LEVELS = [
  { value: "L3", label: "L3 (Entry-Level/New Grad)" },
  { value: "L4", label: "L4 (Software Engineer)" },
  { value: "L5", label: "L5 (Senior Software Engineer)" },
  { value: "L6", label: "L6 (Staff Software Engineer)" },
  { value: "L7", label: "L7 (Senior Staff / Principal)" },
] as const;

export type FaangLevel = typeof FAANG_LEVELS[number]['value'];

export const LOCAL_STORAGE_KEYS = {
  INTERVIEW_SETUP: 'interviewAI_setup',
  INTERVIEW_SESSION: 'interviewAI_session',
};
