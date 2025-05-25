
import type { InterviewSetupData, ThemedInterviewPack } from './types';

export const INTERVIEW_TYPES = [
  { value: "product sense", label: "Product Sense" },
  { value: "technical system design", label: "Technical System Design" },
  { value: "behavioral", label: "Behavioral" },
  { value: "machine learning", label: "Machine Learning" },
  { value: "data structures & algorithms", label: "Data Structures & Algorithms" },
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

export const INTERVIEWER_PERSONAS = [
  { value: "standard", label: "Standard Interviewer" },
  { value: "friendly_peer", label: "Friendly Peer Interviewer" },
  { value: "skeptical_hiring_manager", label: "Skeptical Hiring Manager" },
  { value: "time_pressed_technical_lead", label: "Time-Pressed Technical Lead" },
  { value: "behavioral_specialist", label: "Behavioral Specialist (STAR Method Focus)" },
  { value: "antagonistic_challenger", label: "Antagonistic Challenger (Consulting/IB Style)" },
  { value: "apathetic_business_lead", label: "Apathetic Business Lead (Consulting/IB Style)" },
] as const;

export type InterviewerPersona = typeof INTERVIEWER_PERSONAS[number]['value'];


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
  "machine learning": [
    { value: "ml-model-fundamentals", label: "ML Model Fundamentals" },
    { value: "ml-system-design", label: "ML System Design" },
    { value: "data-handling-feature-engineering", label: "Data Handling & Feature Engineering" },
    { value: "ml-evaluation-iteration", label: "Evaluation & Iteration" },
    { value: "ml-ethics-fairness", label: "ML Ethics & Fairness" },
  ],
  "data structures & algorithms": [
    { value: "array-string-manipulation", label: "Array/String Manipulation" },
    { value: "linked-lists", label: "Linked Lists" },
    { value: "trees-graphs", label: "Trees & Graphs" },
    { value: "sorting-searching", label: "Sorting & Searching" },
    { value: "dynamic-programming-recursion", label: "Dynamic Programming/Recursion" },
    { value: "complexity-analysis", label: "Time/Space Complexity Analysis" },
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
      interviewerPersona: 'behavioral_specialist',
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
      interviewerPersona: 'skeptical_hiring_manager',
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
      interviewerPersona: 'time_pressed_technical_lead',
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
      interviewerPersona: 'standard',
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
      interviewerPersona: 'standard',
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
      interviewerPersona: 'standard',
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
      interviewerPersona: 'skeptical_hiring_manager',
    },
  },
  {
    id: 'dsa-foundations-L4',
    label: 'DSA Foundations (L4) - Core Problems',
    description: 'Focuses on foundational Data Structures & Algorithms problems for L4/entry-level software engineers.',
    config: {
      interviewType: 'data structures & algorithms',
      interviewStyle: 'simple-qa',
      faangLevel: 'L4',
      jobTitle: 'Software Engineer',
      targetedSkills: ['array-string-manipulation', 'sorting-searching', 'complexity-analysis'],
      interviewFocus: 'Core algorithmic problem solving and complexity analysis',
      interviewerPersona: 'time_pressed_technical_lead',
    },
  },
];

