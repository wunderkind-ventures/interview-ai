
import TestingUtilitiesPanel from "@/components/testing-utilities-panel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Testing Utilities - InterviewAI",
  description: "Tools for testing backend API functionality.",
};

export default function TestingUtilitiesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center text-primary">
        Backend API Testing Utilities
      </h1>
      <TestingUtilitiesPanel />
    </div>
  );
}
