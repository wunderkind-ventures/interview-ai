
export const INTERVIEW_TYPES = [
  { value: "product sense", label: "Product Sense" },
  { value: "technical system design", label: "Technical System Design" },
  { value: "behavioral", label: "Behavioral" },
] as const;

export type InterviewType = typeof INTERVIEW_TYPES[number]['value'];

export const INTERVIEW_STYLES = [
  { value: "simple-qa", label: "Simple Q&A" },
  { value: "case-study", label: "Case Study (Multi-turn)" },
] as const;

export type InterviewStyle = typeof INTERVIEW_STYLES[number]['value'];

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

export interface Skill {
  value: string;
  label: string;
}

export const SKILLS_BY_INTERVIEW_TYPE: Record<InterviewType, Skill[]> = {
  "product sense": [
    { value: "user-empathy", label: "User Empathy" },
    { value: "product-strategy", label: "Product Strategy" },
    { value: "metrics-analytics", label: "Metrics & Analytics" },
    { value: "execution", label: "Execution & Prioritization" },
    { value: "innovation-creativity", label: "Innovation & Creativity" },
  ],
  "technical system design": [
    { value: "scalability", label: "Scalability & Performance" },
    { value: "api-design", label: "API Design & Integration" },
    { value: "data-modeling", label: "Data Modeling & Databases" },
    { value: "distributed-systems", label: "Distributed Systems & Architecture" },
    { value: "trade-offs-decision-making", label: "Trade-offs & Decision Making" },
  ],
  "behavioral": [
    { value: "leadership", label: "Leadership & Influence" },
    { value: "teamwork-collaboration", label: "Teamwork & Collaboration" },
    { value: "conflict-resolution", label: "Conflict Resolution & Adaptability" },
    { value: "problem-solving-decision-making", label: "Problem Solving & Decision Making" },
    { value: "communication-skills", label: "Communication Skills" },
  ],
};

export const AMAZON_LEADERSHIP_PRINCIPLES = [
  "Customer Obsession",
  "Ownership",
  "Invent and Simplify",
  "Are Right, A Lot",
  "Learn and Be Curious",
  "Hire and Develop the Best",
  "Insist on the Highest Standards",
  "Think Big",
  "Bias for Action",
  "Frugality",
  "Earn Trust",
  "Dive Deep",
  "Have Backbone; Disagree and Commit",
  "Deliver Results",
  "Strive to be Earth’s Best Employer",
  "Success and Scale Bring Broad Responsibility",
] as const;

