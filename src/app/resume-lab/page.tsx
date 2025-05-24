
import ResumeLabAnalyzer from "@/components/resume-lab-analyzer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resume Lab - AI Powered Analysis & Tailoring",
  description: "Get AI-driven feedback on your resume and suggestions for tailoring it to specific job descriptions.",
};

export default function ResumeLabPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <ResumeLabAnalyzer />
    </div>
  );
}
