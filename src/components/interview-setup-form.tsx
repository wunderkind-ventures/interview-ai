
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Brain, FileText, UserCircle, Star, Workflow, Users, Loader2, MessagesSquare, ListChecks, Lightbulb, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { INTERVIEW_TYPES, FAANG_LEVELS, LOCAL_STORAGE_KEYS, InterviewType, FaangLevel, INTERVIEW_STYLES, InterviewStyle } from "@/lib/constants";
import type { InterviewSetupData } from "@/lib/types";
import { summarizeResume } from "@/ai/flows/summarize-resume";
import type { SummarizeResumeOutput } from "@/ai/flows/summarize-resume";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  interviewType: z.custom<InterviewType>((val) => INTERVIEW_TYPES.some(it => it.value === val), {
    message: "Please select an interview type.",
  }),
  interviewStyle: z.custom<InterviewStyle>((val) => INTERVIEW_STYLES.some(is => is.value === val), {
    message: "Please select an interview style.",
  }),
  faangLevel: z.custom<FaangLevel>((val) => FAANG_LEVELS.some(fl => fl.value === val), {
    message: "Please select a FAANG level.",
  }),
  jobDescription: z.string().optional(),
  resume: z.string().optional(),
});

export default function InterviewSetupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [resumeSummary, setResumeSummary] = useState<string | null>(null);
  const [isSummarizingResume, setIsSummarizingResume] = useState(false);
  const [resumeSummaryError, setResumeSummaryError] = useState<string | null>(null);
  const [summarizedForResumeText, setSummarizedForResumeText] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      interviewType: INTERVIEW_TYPES[0].value,
      interviewStyle: INTERVIEW_STYLES[0].value,
      faangLevel: FAANG_LEVELS[1].value,
      jobDescription: "",
      resume: "",
    },
  });

  const handleResumeAnalysis = async () => {
    const currentResumeText = form.getValues('resume');
    if (!currentResumeText || currentResumeText.trim() === "") {
      setResumeSummary(null);
      setResumeSummaryError(null);
      setSummarizedForResumeText(null);
      setIsSummarizingResume(false); // Ensure loading is stopped if text is cleared
      return;
    }

    if (currentResumeText === summarizedForResumeText && !resumeSummaryError) {
      // No change in resume text and no previous error, or summary already exists
      return;
    }

    setIsSummarizingResume(true);
    setResumeSummary(null); // Clear previous summary
    setResumeSummaryError(null);

    try {
      const result: SummarizeResumeOutput = await summarizeResume({ resume: currentResumeText });
      setResumeSummary(result.summary);
      setSummarizedForResumeText(currentResumeText);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze resume.";
      setResumeSummaryError(errorMessage);
      toast({
        title: "Resume Analysis Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSummarizingResume(false);
    }
  };
  
  // Effect to load existing setup from localStorage
  useEffect(() => {
    const storedSetup = localStorage.getItem(LOCAL_STORAGE_KEYS.INTERVIEW_SETUP);
    if (storedSetup) {
      try {
        const parsedSetup = JSON.parse(storedSetup) as InterviewSetupData;
        form.reset({
          interviewType: parsedSetup.interviewType,
          interviewStyle: parsedSetup.interviewStyle,
          faangLevel: parsedSetup.faangLevel,
          jobDescription: parsedSetup.jobDescription || "",
          resume: parsedSetup.resume || "",
        });
        // Optionally, trigger analysis if resume was present
        if (parsedSetup.resume && parsedSetup.resume.trim() !== "") {
           // Set summarizedForResumeText to avoid initial auto-analysis if resume is unchanged
           setSummarizedForResumeText(parsedSetup.resume); 
           // No, don't auto-analyze on load. Let user blur or click.
           // handleResumeAnalysis(); 
        }
      } catch (e) {
        console.error("Failed to parse stored interview setup:", e);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.INTERVIEW_SETUP);
      }
    }
  }, [form]);


  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const setupData: InterviewSetupData = {
      interviewType: values.interviewType,
      interviewStyle: values.interviewStyle,
      faangLevel: values.faangLevel,
      jobDescription: values.jobDescription,
      resume: values.resume,
    };
    localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SETUP, JSON.stringify(setupData));
    // Clear any existing session data to ensure a fresh start for the new setup
    localStorage.removeItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION); 
    router.push("/interview");
  }

  const getIconForType = (type: InterviewType) => {
    switch (type) {
      case "product sense": return <Brain className="mr-2 h-4 w-4" />;
      case "technical system design": return <Workflow className="mr-2 h-4 w-4" />;
      case "behavioral": return <Users className="mr-2 h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center text-primary">Start Your Mock Interview</CardTitle>
        <CardDescription className="text-center text-muted-foreground pt-1">
          Configure your interview session and let our AI guide you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="interviewType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-lg">
                    <Brain className="mr-2 h-5 w-5 text-primary" />
                    Interview Type
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={INTERVIEW_TYPES[0].value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an interview type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INTERVIEW_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center">
                            {getIconForType(type.value)}
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose the category for your mock interview.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="interviewStyle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-lg">
                    <MessagesSquare className="mr-2 h-5 w-5 text-primary" />
                    Interview Style
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={INTERVIEW_STYLES[0].value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an interview style" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INTERVIEW_STYLES.map((style) => (
                        <SelectItem key={style.value} value={style.value}>
                          <div className="flex items-center">
                            {style.value === 'simple-qa' ? <ListChecks className="mr-2 h-4 w-4" /> : <MessagesSquare className="mr-2 h-4 w-4" />}
                            {style.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose question delivery: direct Q&amp;A or multi-turn case studies.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="faangLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-lg">
                    <Star className="mr-2 h-5 w-5 text-primary" />
                    Target FAANG Level
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={FAANG_LEVELS[1].value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a FAANG level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FAANG_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the difficulty level for your interview.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jobDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-lg">
                    <FileText className="mr-2 h-5 w-5 text-primary" />
                    Job Description (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste the job description here to tailor questions..."
                      className="resize-y min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Providing a job description helps personalize the interview questions.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="resume"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-lg">
                    <UserCircle className="mr-2 h-5 w-5 text-primary" />
                    Your Resume (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste your resume content here for further personalization..."
                      className="resize-y min-h-[120px]"
                      {...field}
                      onBlur={handleResumeAnalysis} // Analyze on blur
                    />
                  </FormControl>
                  <FormDescription>
                    Your resume can help the AI ask more relevant questions and provide key insights below.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(isSummarizingResume || resumeSummaryError || resumeSummary) && (
              <div className="space-y-2">
                {isSummarizingResume && (
                  <Alert>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <AlertTitle>Analyzing Resume...</AlertTitle>
                    <AlertDescription>
                      Please wait while we extract key points from your resume.
                    </AlertDescription>
                  </Alert>
                )}
                {resumeSummaryError && !isSummarizingResume && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-5 w-5" />
                    <AlertTitle>Resume Analysis Error</AlertTitle>
                    <AlertDescription>
                      {resumeSummaryError}
                      <Button variant="link" size="sm" onClick={handleResumeAnalysis} className="p-0 h-auto ml-1">Try again</Button>
                    </AlertDescription>
                  </Alert>
                )}
                {resumeSummary && !isSummarizingResume && !resumeSummaryError && (
                  <Alert variant="default" className="bg-accent/10 border-accent/30">
                    <Lightbulb className="h-5 w-5 text-accent" />
                    <AlertTitle className="text-accent">Resume Highlights</AlertTitle>
                    <AlertDescription className="whitespace-pre-wrap text-foreground/80">
                      {resumeSummary}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            
            <Button type="submit" className="w-full text-lg py-6" disabled={isSubmitting || isSummarizingResume}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Starting Interview...
                </>
              ) : (
                "Start Interview"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

