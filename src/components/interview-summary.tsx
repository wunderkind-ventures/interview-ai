
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, Home, MessageSquare, Edit, Sparkles, FileText } from "lucide-react";
import { LOCAL_STORAGE_KEYS } from "@/lib/constants";
import type { InterviewSessionData, InterviewFeedback, FeedbackItem, Answer, InterviewQuestion } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { generateInterviewFeedback } from "@/ai/flows/generate-interview-feedback";
import type { GenerateInterviewFeedbackInput } from "@/ai/flows/generate-interview-feedback";

export default function InterviewSummary() {
  const router = useRouter();
  const { toast } = useToast();
  const [sessionData, setSessionData] = useState<InterviewSessionData | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const fetchAndSetFeedback = useCallback(async (currentSession: InterviewSessionData) => {
    if (!currentSession.interviewFinished || currentSession.feedback || isFeedbackLoading) {
      return;
    }

    setIsFeedbackLoading(true);
    setFeedbackError(null);

    try {
      const feedbackInput: GenerateInterviewFeedbackInput = {
        questions: currentSession.questions as { id: string; text: string; }[], // Type assertion
        answers: currentSession.answers as Answer[], // Type assertion
        interviewType: currentSession.interviewType,
        interviewStyle: currentSession.interviewStyle,
        faangLevel: currentSession.faangLevel,
        jobDescription: currentSession.jobDescription,
        resume: currentSession.resume,
      };

      const feedbackResult = await generateInterviewFeedback(feedbackInput);
      
      setSessionData(prev => {
        if (!prev) return null;
        const updatedSession = { ...prev, feedback: feedbackResult };
        localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(updatedSession));
        return updatedSession;
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred while generating feedback.";
      toast({
        title: "Error generating feedback",
        description: errorMessage,
        variant: "destructive",
      });
      setFeedbackError(errorMessage);
    } finally {
      setIsFeedbackLoading(false);
    }
  }, [toast, isFeedbackLoading]);

  useEffect(() => {
    const storedSession = localStorage.getItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION);
    if (storedSession) {
      const parsedSession: InterviewSessionData = JSON.parse(storedSession);
      if (!parsedSession.interviewFinished) {
        toast({ title: "Interview Not Finished", description: "Redirecting...", variant: "default"});
        const storedSetup = localStorage.getItem(LOCAL_STORAGE_KEYS.INTERVIEW_SETUP);
        if (storedSetup && parsedSession.interviewStarted && parsedSession.questions.length > 0) {
             router.replace("/interview");
        } else {
            router.replace("/");
        }
        return;
      }
      setSessionData(parsedSession);
      setIsSessionLoading(false);
      if (!parsedSession.feedback) {
        fetchAndSetFeedback(parsedSession);
      }
    } else {
      toast({ title: "No Interview Data", description: "Please start an interview first.", variant: "destructive"});
      router.replace("/");
      setIsSessionLoading(false);
    }
  }, [router, toast, fetchAndSetFeedback]);

  if (isSessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading your interview summary...</p>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Edit className="h-5 w-5" />
        <AlertTitle>No Interview Data Found</AlertTitle>
        <AlertDescription>
          We couldn't find data for your session. Please start a new interview.
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

  const getFeedbackForQuestion = (questionId: string) => {
    return sessionData.feedback?.feedbackItems.find(item => item.questionId === questionId);
  }

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
      <CardHeader className="text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <CardTitle className="text-3xl font-bold text-primary">Interview Completed!</CardTitle>
        <CardDescription className="text-muted-foreground pt-1">
          Summary for your {sessionData.interviewType} ({sessionData.interviewStyle}) interview. Level: {sessionData.faangLevel}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-3 flex items-center text-foreground">
            <FileText className="mr-2 h-6 w-6 text-accent" />
            Questions & Answers
          </h3>
          {sessionData.questions.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {sessionData.questions.map((question, index) => {
                const feedbackItem = getFeedbackForQuestion(question.id);
                return (
                  <AccordionItem value={`item-${index}`} key={question.id}>
                    <AccordionTrigger className="text-lg hover:no-underline">
                      <div className="flex items-start text-left">
                        <MessageSquare className="h-5 w-5 mr-3 mt-1 shrink-0 text-primary" />
                        Question {index + 1}: {question.text}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-base pl-8 space-y-4">
                      <div>
                        <p className="font-semibold text-muted-foreground mb-1">Your Answer:</p>
                        <p className="whitespace-pre-wrap bg-secondary/50 p-3 rounded-md">{getAnswerForQuestion(question.id)}</p>
                      </div>
                      {feedbackItem && (
                        <div>
                          <p className="font-semibold text-muted-foreground mb-1 flex items-center">
                            <Sparkles className="h-4 w-4 mr-2 text-accent" />
                            AI Feedback:
                          </p>
                          <p className="whitespace-pre-wrap bg-accent/10 p-3 rounded-md border border-accent/30">{feedbackItem.feedbackText}</p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <p className="text-center text-muted-foreground">No questions were asked in this session.</p>
          )}
        </div>

        {isFeedbackLoading && (
          <div className="flex flex-col items-center justify-center py-6">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-lg text-muted-foreground">Generating your personalized feedback...</p>
          </div>
        )}

        {feedbackError && !isFeedbackLoading && (
          <Alert variant="destructive">
            <Edit className="h-5 w-5" />
            <AlertTitle>Feedback Generation Error</AlertTitle>
            <AlertDescription>{feedbackError}</AlertDescription>
            <Button onClick={() => fetchAndSetFeedback(sessionData)} className="mt-3" variant="outline" size="sm">
              Retry Feedback Generation
            </Button>
          </Alert>
        )}

        {sessionData.feedback && !isFeedbackLoading && !feedbackError && (
          <div>
            <h3 className="text-xl font-semibold mb-3 flex items-center text-foreground">
              <Sparkles className="mr-2 h-6 w-6 text-accent" />
              Overall Summary & Advice
            </h3>
            <div className="whitespace-pre-wrap bg-accent/10 p-4 rounded-md border border-accent/30 text-base">
              {sessionData.feedback.overallSummary}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={() => {
            localStorage.removeItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION); // Clear session before starting new
            router.push("/");
          }} 
          className="w-full text-lg py-6"
        >
          <Home className="mr-2 h-5 w-5" />
          Start Another Interview
        </Button>
      </CardFooter>
    </Card>
  );
}
