"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

// Import step components
import StepBasics from "./interview-setup/step-basics";
import StepContext from "./interview-setup/step-context";
import StepDocuments from "./interview-setup/step-documents";

// Import types and constants
import type { InterviewSetupData } from "@/lib/types";
import { INTERVIEW_TYPES, FAANG_LEVELS } from "@/lib/constants";

interface Step {
  id: number;
  title: string;
  description: string;
}

// Form validation schema
const formSchema = z.object({
  interviewType: z.string().min(1, "Please select an interview type"),
  interviewStyle: z.string().min(1, "Please select an interview style"),
  faangLevel: z.string().min(1, "Please select a level"),
  interviewerPersona: z.string().optional(),
  targetCompany: z.string().optional(),
  jobTitle: z.string().optional(),
  roleType: z.string().optional(),
  skills: z.array(z.string()).optional(),
  yearsOfExperience: z.number().optional(),
  resumeText: z.string().optional(),
  jobDescription: z.string().optional(),
});

const steps: Step[] = [
  {
    id: 1,
    title: "Interview Basics",
    description: "Choose your interview type and style",
  },
  {
    id: 2,
    title: "Context & Details",
    description: "Add company and role information",
  },
  {
    id: 3,
    title: "Documents",
    description: "Upload resume and job description",
  },
];

export default function InterviewSetupWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InterviewSetupData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      interviewType: "",
      interviewStyle: "",
      faangLevel: "",
      skills: [],
    },
  });

  const handleNextStep = async () => {
    // Validate current step fields
    let fieldsToValidate: (keyof InterviewSetupData)[] = [];
    
    if (currentStep === 1) {
      fieldsToValidate = ["interviewType", "interviewStyle", "faangLevel"];
    }
    
    const isValid = fieldsToValidate.length === 0 || 
      await form.trigger(fieldsToValidate);
    
    if (isValid && currentStep < steps.length) {
      setCompletedSteps([...completedSteps, currentStep]);
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (stepId: number) => {
    if (stepId <= Math.max(...completedSteps, 1)) {
      setCurrentStep(stepId);
    }
  };

  const onSubmit = async (data: InterviewSetupData) => {
    setIsSubmitting(true);
    try {
      // Store setup data and navigate to interview
      sessionStorage.setItem("interviewSetup", JSON.stringify(data));
      router.push("/interview/session");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start interview. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex items-center cursor-pointer"
              onClick={() => goToStep(step.id)}
            >
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all",
                    currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : completedSteps.includes(step.id)
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {completedSteps.includes(step.id) ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    step.id
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div
                    className={cn(
                      "text-sm font-medium transition-colors",
                      currentStep === step.id
                        ? "text-primary"
                        : completedSteps.includes(step.id)
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-muted-foreground hidden sm:block">
                    {step.description}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4 transition-colors",
                    completedSteps.includes(step.id)
                      ? "bg-primary"
                      : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep - 1].title}</CardTitle>
          <CardDescription>{steps[currentStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Step Content */}
                  <div className="min-h-[400px]">
                    {currentStep === 1 && <StepBasics form={form} />}
                    {currentStep === 2 && <StepContext form={form} />}
                    {currentStep === 3 && <StepDocuments form={form} />}
                  </div>
                  
                  {/* Navigation buttons */}
                  <div className="flex justify-between pt-6 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrevStep}
                      disabled={currentStep === 1}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Previous
                    </Button>
                    
                    {currentStep < steps.length ? (
                      <Button type="button" onClick={handleNextStep}>
                        Next
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-primary to-accent"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          <>
                            Start Interview
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Quick tip */}
      <div className="mt-4 text-center text-sm text-muted-foreground">
        Tip: You can click on completed steps to go back and review
      </div>
    </div>
  );
}