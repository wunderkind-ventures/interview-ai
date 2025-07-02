import InterviewSetupForm from "@/components/interview-setup-form";

export default function InterviewSetupPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Prepare for Your Interview</h1>
          <p className="mt-2 text-muted-foreground">Configure your mock interview session below</p>
        </div>
        <InterviewSetupForm />
      </div>
    </div>
  );
}