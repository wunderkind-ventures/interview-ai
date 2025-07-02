import InterviewSetupWizard from "@/components/interview-setup-wizard";
import { Sparkles } from "lucide-react";

export default function InterviewSetupPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-4">
            <Sparkles className="h-4 w-4" />
            <span>Personalized Interview Experience</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Prepare for Your Interview</h1>
          <p className="mt-2 text-muted-foreground">Let's set up your perfect mock interview in just 3 steps</p>
        </div>
        <InterviewSetupWizard />
      </div>
    </div>
  );
}