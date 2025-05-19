
import type { InterviewSetupData, ThemedInterviewPack, Skill } from './types';

export const INTERVIEW_TYPES = [
  { value: "product sense", label: "Product Sense" },
  { value: "technical system design", label: "Technical System Design" },
  { value: "behavioral", label: "Behavioral" },
  { value: "machine learning", label: "Machine Learning" },
] as const;

export type InterviewType = typeof INTERVIEW_TYPES[number]['value'];

export const INTERVIEW_STYLES = [
  { value: "simple-qa", label: "Simple Q&A" },
  { value: "case-study", label: "Case Study (Multi-turn)" },
  { value: "take-home", label: "Take Home Assignment" },
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
  "machine learning": [
    { value: "ml-model-fundamentals", label: "ML Model Fundamentals" },
    { value: "ml-system-design", label: "ML System Design" },
    { value: "data-handling-feature-engineering", label: "Data Handling & Feature Engineering" },
    { value: "ml-evaluation-iteration", label: "Evaluation & Iteration" },
    { value: "ml-ethics-fairness", label: "ML Ethics & Fairness" },
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

export const THEMED_INTERVIEW_PACKS: ThemedInterviewPack[] = [
  {
    id: 'amazon-sde2-behavioral-lp',
    label: 'Amazon SDE II - Behavioral & LP Focus',
    description: 'Focuses on behavioral questions tailored for an Amazon SDE II role, emphasizing Leadership Principles.',
    config: {
      interviewType: 'behavioral',
      faangLevel: 'L5',
      targetCompany: 'Amazon',
      jobTitle: 'Software Engineer II',
      targetedSkills: ['leadership', 'problem-solving-decision-making', 'communication-skills'],
      interviewFocus: 'Demonstrating Amazon Leadership Principles through past experiences',
      interviewStyle: 'simple-qa',
    },
  },
  {
    id: 'faang-pm-product-strategy',
    label: 'FAANG PM - Product Strategy Deep Dive',
    description: 'A product sense interview for a FAANG Product Manager, diving deep into product strategy and vision.',
    config: {
      interviewType: 'product sense',
      interviewStyle: 'case-study',
      faangLevel: 'L6',
      targetedSkills: ['product-strategy', 'innovation-creativity', 'metrics-analytics'],
      jobTitle: 'Senior Product Manager',
      interviewFocus: 'Developing a 5-year product vision for a new market entry',
      targetCompany: 'Google', 
    },
  },
  {
    id: 'startup-system-design-mvp',
    label: 'Startup System Design - MVP & Scalability',
    description: 'Technical system design challenge for a startup environment, focusing on MVP architecture and early scalability challenges.',
    config: {
      interviewType: 'technical system design',
      interviewStyle: 'case-study',
      faangLevel: 'L4', 
      targetedSkills: ['scalability', 'api-design', 'trade-offs-decision-making'],
      jobTitle: 'Founding Engineer',
      interviewFocus: 'Designing the initial architecture for a B2C photo sharing service expecting rapid growth',
    },
  },
  {
    id: 'general-behavioral-L4',
    label: 'General Behavioral - Mid-Level (L4)',
    description: 'Standard behavioral interview questions suitable for a mid-level individual contributor role at various tech companies.',
    config: {
      interviewType: 'behavioral',
      interviewStyle: 'simple-qa',
      faangLevel: 'L4',
      targetedSkills: ['teamwork-collaboration', 'problem-solving-decision-making', 'communication-skills'],
      jobTitle: 'Software Engineer',
    },
  },
  {
    id: 'product-manager-take-home-metrics',
    label: 'PM Take-Home - Metrics & Analysis Focus',
    description: 'A take-home assignment for Product Managers centered around defining, measuring, and analyzing product metrics.',
    config: {
      interviewType: 'product sense',
      interviewStyle: 'take-home',
      faangLevel: 'L5',
      jobTitle: 'Product Manager, Analytics',
      targetedSkills: ['metrics-analytics', 'product-strategy'],
      interviewFocus: 'Defining a metrics framework for a new feature launch and analyzing its potential impact.',
    }
  },
  {
    id: 'ml-engineer-conceptual-L4',
    label: 'ML Engineer (L4) - Conceptual Foundations',
    description: 'Focuses on core machine learning concepts for an L4 ML Engineer.',
    config: {
      interviewType: 'machine learning',
      interviewStyle: 'simple-qa',
      faangLevel: 'L4',
      jobTitle: 'Machine Learning Engineer',
      targetedSkills: ['ml-model-fundamentals', 'ml-evaluation-iteration'],
      interviewFocus: 'Understanding core ML algorithms and evaluation techniques',
    },
  },
  {
    id: 'senior-ml-system-design-case',
    label: 'Senior ML Engineer (L6) - System Design Case',
    description: 'A case study focusing on ML system design for a senior ML Engineer role.',
    config: {
      interviewType: 'machine learning',
      interviewStyle: 'case-study',
      faangLevel: 'L6',
      jobTitle: 'Senior Machine Learning Engineer',
      targetedSkills: ['ml-system-design', 'data-handling-feature-engineering', 'scalability'],
      interviewFocus: 'Designing a large-scale recommendation system',
    },
  }
];
