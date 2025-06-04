
import AssessmentRepositoryManager from "@/components/assessment-repository-manager";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Assessment Repository - InterviewAI",
  description: "Manage and contribute to a repository of interview assessments.",
};

export default function AssessmentRepositoryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <AssessmentRepositoryManager />
    </div>
  );
}
