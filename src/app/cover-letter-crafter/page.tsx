
import CoverLetterCrafter from "@/components/cover-letter-crafter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cover Letter Crafter - InterviewAI",
  description: "Generate a tailored cover letter using your resume, achievements, and job description.",
};

export default function CoverLetterCrafterPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <CoverLetterCrafter />
    </div>
  );
}

    