
import InterviewHistoryList from "@/components/interview-history-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interview History - InterviewAI",
  description: "Review your past mock interview sessions and track your progress.",
};

export default function InterviewHistoryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center text-primary">Interview History</h1>
      <InterviewHistoryList />
    </div>
  );
}
