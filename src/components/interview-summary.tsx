"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, Home, MessageSquare, Edit } from "lucide-react";
import { LOCAL_STORAGE_KEYS } from "@/lib/constants";
import type { InterviewSessionData } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

export default function InterviewSummary() {
  const router = useRouter();
  const { toast } = useToast();
  const [sessionData, setSessionData] = useState<InterviewSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedSession = localStorage.getItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION);
    if (storedSession) {
      const parsedSession: InterviewSessionData = JSON.parse(storedSession);
      if (!parsedSession.interviewFinished) {
        // If interview wasn't marked as finished, redirect back to active interview or setup
        toast({ title: "Interview Not Finished", description: "Redirecting to continue or setup new interview.", variant: "default"});
        const storedSetup = localStorage.getItem(LOCAL_STORAGE_KEYS.INTERVIEW_SETUP);
        if (storedSetup && parsedSession.interviewStarted && parsedSession.questions.length > 0) {
             router.replace("/interview"); // ongoing interview
        } else {
            router.replace("/"); // needs setup
        }
        return;
      }
      setSessionData(parsedSession);
    } else {
      // No session data, redirect to home
      toast({ title: "No Interview Data", description: "Please start an interview first.", variant: "destructive"});
      router.replace("/");
    }
    setIsLoading(false);
  }, [router, toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading your feedback...</p>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Edit className="h-5 w-5" />
        <AlertTitle>No Interview Data Found</AlertTitle>
        <AlertDescription>
          We couldn't find any data for your interview session. Please start a new interview.
        </AlertDescription>
        <Button onClick={() => router.push("/")} className="mt-4">
          <Home className="mr-2 h-4 w-4" />
          Start New Interview
        </Button>
      </Alert>
    );
  }
  
  const getAnswerForQuestion = (questionId: string) => {
    const answerObj = sessionData.answers.find(ans => ans.questionId === questionId);
    return answerObj ? answerObj.answerText : "No answer provided.";
  };

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
      <CardHeader className="text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <CardTitle className="text-3xl font-bold text-primary">Interview Completed!</CardTitle>
        <CardDescription className="text-muted-foreground pt-1">
          Here's a summary of your {sessionData.interviewType} interview (Level: {sessionData.faangLevel}).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessionData.questions.length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
            {sessionData.questions.map((question, index) => (
              <AccordionItem value={`item-${index}`} key={question.id}>
                <AccordionTrigger className="text-lg hover:no-underline">
                  <div className="flex items-start text-left">
                    <MessageSquare className="h-5 w-5 mr-3 mt-1 shrink-0 text-primary" />
                    Question {index + 1}: {question.text}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-base pl-8">
                  <p className="font-semibold text-muted-foreground mb-1">Your Answer:</p>
                  <p className="whitespace-pre-wrap bg-secondary/50 p-3 rounded-md">{getAnswerForQuestion(question.id)}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <p className="text-center text-muted-foreground">No questions were asked in this session.</p>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={() => router.push("/")} className="w-full text-lg py-6">
          <Home className="mr-2 h-5 w-5" />
          Start Another Interview
        </Button>
      </CardFooter>
    </Card>
  );
}
