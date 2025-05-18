"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Brain, FileText, UserCircle, Star, Workflow, Users, Loader2 } from "lucide-react";

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
import { INTERVIEW_TYPES, FAANG_LEVELS, LOCAL_STORAGE_KEYS, InterviewType, FaangLevel } from "@/lib/constants";
import type { InterviewSetupData } from "@/lib/types";
import { useState } from "react";

const formSchema = z.object({
  interviewType: z.custom<InterviewType>((val) => INTERVIEW_TYPES.some(it => it.value === val), {
    message: "Please select an interview type.",
  }),
  faangLevel: z.custom<FaangLevel>((val) => FAANG_LEVELS.some(fl => fl.value === val), {
    message: "Please select a FAANG level.",
  }),
  jobDescription: z.string().optional(),
  resume: z.string().optional(),
});

export default function InterviewSetupForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      interviewType: INTERVIEW_TYPES[0].value,
      faangLevel: FAANG_LEVELS[1].value,
      jobDescription: "",
      resume: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const setupData: InterviewSetupData = {
      interviewType: values.interviewType,
      faangLevel: values.faangLevel,
      jobDescription: values.jobDescription,
      resume: values.resume,
    };
    localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SETUP, JSON.stringify(setupData));
    // Clear previous session data if any
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              name="faangLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-lg">
                    <Star className="mr-2 h-5 w-5 text-primary" />
                    Target FAANG Level
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    />
                  </FormControl>
                  <FormDescription>
                    Your resume can help the AI ask more relevant questions.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full text-lg py-6" disabled={isSubmitting}>
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
