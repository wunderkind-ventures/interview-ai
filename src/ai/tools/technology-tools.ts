'use server';
/**
 * @fileOverview Defines Genkit tools for fetching domain-specific information, initially focused on technology briefs.
 *
 * - getTechnologyBriefTool - A tool that provides a brief summary for a given technology name.
 */

import { type Genkit } from 'genkit'; // Import Genkit type for the instance
import { z } from 'genkit';

const TechnologyBriefInputSchema = z.object({
  technologyName: z.string().describe('The name of the technology to get a brief summary for (e.g., Kafka, Kubernetes, GraphQL).'),
});

const TechnologyBriefOutputSchema = z.string().describe('A brief, factual summary of the technology and its primary use case, or a statement if the technology is not recognized in the brief.');

// A simple hardcoded map for demonstration purposes.
// In a real-world scenario, this might query a database or an external API.
const technologySummaries: Record<string, string> = {
  "kafka": "Apache Kafka is an open-source distributed event streaming platform used for high-performance data pipelines, streaming analytics, data integration, and mission-critical applications. It allows publishing and subscribing to streams of records, similar to a message queue or enterprise messaging system.",
  "kubernetes": "Kubernetes (K8s) is an open-source system for automating deployment, scaling, and management of containerized applications. It groups containers that make up an application into logical units for easy management and discovery.",
  "graphql": "GraphQL is a query language for APIs and a server-side runtime for executing those queries by using a type system you define for your data. GraphQL isn't tied to any specific database or storage engine and is instead backed by your existing code and data.",
  "react": "React is a free and open-source front-end JavaScript library for building user interfaces based on UI components. It is maintained by Meta and a community of individual developers and companies.",
  "next.js": "Next.js is an open-source web development framework created by Vercel enabling React-based web applications with server-side rendering and generating static websites.",
  "python": "Python is an interpreted, object-oriented, high-level programming language with dynamic semantics. Its high-level built-in data structures, combined with dynamic typing and dynamic binding, make it very attractive for Rapid Application Development, as well as for use as a scripting or glue language to connect existing components together.",
  "java": "Java is a high-level, class-based, object-oriented programming language that is designed to have as few implementation dependencies as possible. It is a general-purpose programming language intended to let application developers write once, run anywhere (WORA).",
  "aws lambda": "AWS Lambda is a serverless, event-driven compute service that lets you run code for virtually any type of application or backend service without provisioning or managing servers. You can trigger Lambda from over 200 AWS services and software as a service (SaaS) applications, and only pay for what you use.",
  "amazon s3": "Amazon Simple Storage Service (Amazon S3) is an object storage service offering industry-leading scalability, data availability, security, and performance. Customers of all sizes and industries can store and protect any amount of data for virtually any use case, such as data lakes, cloud-native applications, and mobile apps.",
  "machine learning": "Machine learning (ML) is a field of study in artificial intelligence concerned with the development and study of statistical algorithms that can learn from data and generalize to unseen data, and thus perform tasks without explicit instructions."
};

// Export a function that defines the tool on a given Genkit instance
export async function defineGetTechnologyBriefTool(kit: Genkit) {
  return kit.defineTool(
  {
    name: 'getTechnologyBriefTool',
    description: 'Provides a brief, factual summary of a specific technology and its primary use case. Useful when encountering a technology term that needs clarification for generating relevant interview questions or feedback.',
    inputSchema: TechnologyBriefInputSchema,
    outputSchema: TechnologyBriefOutputSchema,
  },
    async (input): Promise<string> => {
    const techNameLower = input.technologyName.toLowerCase();
    if (technologySummaries[techNameLower]) {
      return technologySummaries[techNameLower];
    }
    return `Information for "${input.technologyName}" is not available in the current brief. Please proceed based on general knowledge or ask for clarification if essential.`;
  }
);
}
