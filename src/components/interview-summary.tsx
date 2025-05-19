
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, Home, MessageSquare, Edit, Sparkles, FileText, TimerIcon, Building, Briefcase, ThumbsUp, TrendingDown, Lightbulb, MessageCircle, CheckSquare } from "lucide-react";
import { LOCAL_STORAGE_KEYS } from "@/lib/constants";
import type { InterviewSessionData, FeedbackItem } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { generateInterviewFeedback } from "@/ai/flows/generate-interview-feedback";
import type { GenerateInterviewFeedbackInput } from "@/ai/flows/generate-interview-feedback";
import { formatMilliseconds } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
      const questionsForFeedback = currentSession.questions.map(q => ({ id: q.id, text: q.text }));
      const answersForFeedback = currentSession.answers.map(a => ({ 
        questionId: a.questionId, 
        answerText: a.answerText,
        timeTakenMs: a.timeTakenMs 
      }));

      const feedbackInput: GenerateInterviewFeedbackInput = {
        questions: questionsForFeedback,
        answers: answersForFeedback,
        interviewType: currentSession.interviewType,
        interviewStyle: currentSession.interviewStyle,
        faangLevel: currentSession.faangLevel,
        jobTitle: currentSession.jobTitle,
        jobDescription: currentSession.jobDescription,
        resume: currentSession.resume,
      };

      const feedbackResult = await generateInterviewFeedback(feedbackInput);
      
      setSessionData(prev => {
        if (!prev) return null;
        const updatedFeedbackItems = feedbackResult.feedbackItems.map(item => {
            const originalAnswer = currentSession.answers.find(ans => ans.questionId === item.questionId);
            return {
                ...item,
                timeTakenMs: originalAnswer?.timeTakenMs
            };
        });

        const updatedSession = { ...prev, feedback: {...feedbackResult, feedbackItems: updatedFeedbackItems} };
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
      if (!parsedSession.feedback && parsedSession.answers.length > 0) {
        fetchAndSetFeedback(parsedSession);
      } else if (parsedSession.answers.length === 0) {
        setIsFeedbackLoading(false); 
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
  
  const getAnswerInfoForQuestion = (questionId: string): { answerText: string; timeTakenMs?: number } => {
    const answerObj = sessionData.answers.find(ans => ans.questionId === questionId);
    return {
      answerText: answerObj ? answerObj.answerText : "No answer provided.",
      timeTakenMs: answerObj?.timeTakenMs
    };
  };

  const getFeedbackItemForQuestion = (questionId: string): FeedbackItem | undefined => {
    return sessionData.feedback?.feedbackItems.find(item => item.questionId === questionId);
  }

  const isTakeHomeStyle = sessionData.interviewStyle === 'take-home';

  const renderFeedbackSection = (title: string, items: string[] | undefined, icon: React.ReactNode, badgeVariant: "default" | "secondary" | "destructive" | "outline" = "secondary") => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mt-3">
        <h5 className="font-semibold text-muted-foreground mb-2 flex items-center">
          {icon}
          {title}:
        </h5>
        <ul className="list-none space-y-1 pl-0">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start">
               <Badge variant={badgeVariant} className="mr-2 mt-1 text-xs whitespace-normal break-words">{item}</Badge>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
      <CardHeader className="text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <CardTitle className="text-3xl font-bold text-primary">Interview Completed!</CardTitle>
        <CardDescription className="text-muted-foreground pt-1">
          Summary for your {sessionData.interviewType} ({sessionData.interviewStyle}) interview. Level: {sessionData.faangLevel}.
          {sessionData.jobTitle && (
             <span className="block mt-1">
              <Briefcase className="h-4 w-4 mr-1 inline-block text-primary" /> Role: {sessionData.jobTitle}
            </span>
          )}
          {sessionData.targetCompany && (
            <span className="block mt-1">
              <Building className="h-4 w-4 mr-1 inline-block text-primary" />
              Target Company: {sessionData.targetCompany}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-3 flex items-center text-foreground">
            <FileText className="mr-2 h-6 w-6 text-accent" />
            {isTakeHomeStyle ? "Assignment & Submission Feedback" : "Questions, Answers & Feedback"}
          </h3>
          {sessionData.questions.length > 0 ? (
             isTakeHomeStyle ? (
                sessionData.questions.map((question) => {
                    const answerInfo = getAnswerInfoForQuestion(question.id);
                    const feedbackItem = getFeedbackItemForQuestion(question.id);
                    return (
                        <div key={question.id} className="space-y-4 p-4 border rounded-md bg-card">
                            <div>
                                <h4 className="font-semibold text-muted-foreground mb-1">Assignment Description:</h4>
                                <p className="whitespace-pre-wrap bg-secondary/30 p-3 rounded-md border">{question.text}</p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-muted-foreground mb-1">Your Submission:</h4>
                                <p className="whitespace-pre-wrap bg-secondary/30 p-3 rounded-md border">{answerInfo.answerText}</p>
                            </div>
                            {feedbackItem && (
                                <div className="mt-4 p-3 rounded-md bg-accent/5 border border-accent/20">
                                    <h4 className="font-semibold text-accent mb-2 flex items-center">
                                        <Sparkles className="h-5 w-5 mr-2" />
                                        AI Feedback on Submission:
                                    </h4>
                                    {feedbackItem.critique && (
                                      <div className="mb-3">
                                        <h5 className="font-semibold text-muted-foreground mb-1 flex items-center">
                                          <MessageCircle className="h-4 w-4 mr-2 text-primary" /> Overall Critique:
                                        </h5>
                                        <p className="text-sm">{feedbackItem.critique}</p>
                                      </div>
                                    )}
                                    {renderFeedbackSection("Strengths", feedbackItem.strengths, <ThumbsUp className="h-4 w-4 mr-2 text-green-500" />, "secondary")}
                                    {renderFeedbackSection("Areas for Improvement", feedbackItem.areasForImprovement, <TrendingDown className="h-4 w-4 mr-2 text-orange-500" />, "secondary")}
                                    {renderFeedbackSection("Specific Suggestions", feedbackItem.specificSuggestions, <Lightbulb className="h-4 w-4 mr-2 text-blue-500" />, "secondary")}
                                    {renderFeedbackSection("Ideal Submission Pointers", feedbackItem.idealAnswerPointers, <CheckSquare className="h-4 w-4 mr-2 text-purple-500" />, "secondary")}
                                </div>
                            )}
                        </div>
                    );
                })
             ) : (
                <Accordion type="single" collapsible className="w-full">
                {sessionData.questions.map((question, index) => {
                    const answerInfo = getAnswerInfoForQuestion(question.id);
                    const feedbackItem = getFeedbackItemForQuestion(question.id);
                    const displayTime = formatMilliseconds(answerInfo.timeTakenMs);

                    return (
                    <AccordionItem value={`item-${index}`} key={question.id}>
                        <AccordionTrigger className="text-lg hover:no-underline">
                        <div className="flex items-start text-left w-full">
                            <MessageSquare className="h-5 w-5 mr-3 mt-1 shrink-0 text-primary" />
                            <span className="flex-1">Question {index + 1}: {question.text}</span>
                        </div>
                        </AccordionTrigger>
                        <AccordionContent className="text-base pl-8 space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <p className="font-semibold text-muted-foreground">Your Answer:</p>
                                    {answerInfo.timeTakenMs !== undefined && (
                                        <p className="text-xs text-muted-foreground flex items-center">
                                            <TimerIcon className="h-3 w-3 mr-1" /> {displayTime}
                                        </p>
                                    )}
                                </div>
                                <p className="whitespace-pre-wrap bg-secondary/30 p-3 rounded-md">{answerInfo.answerText}</p>
                            </div>
                            {feedbackItem && (
                                <div className="mt-3 p-3 rounded-md bg-accent/5 border border-accent/20">
                                    <h4 className="font-semibold text-accent mb-2 flex items-center">
                                        <Sparkles className="h-5 w-5 mr-2" />
                                        AI Feedback:
                                    </h4>
                                    {feedbackItem.critique && (
                                      <div className="mb-3">
                                        <h5 className="font-semibold text-muted-foreground mb-1 flex items-center">
                                           <MessageCircle className="h-4 w-4 mr-2 text-primary" /> Overall Critique:
                                        </h5>
                                        <p className="text-sm">{feedbackItem.critique}</p>
                                      </div>
                                    )}
                                    {renderFeedbackSection("Strengths", feedbackItem.strengths, <ThumbsUp className="h-4 w-4 mr-2 text-green-500" />, "secondary")}
                                    {renderFeedbackSection("Areas for Improvement", feedbackItem.areasForImprovement, <TrendingDown className="h-4 w-4 mr-2 text-orange-500" />, "secondary")}
                                    {renderFeedbackSection("Specific Suggestions", feedbackItem.specificSuggestions, <Lightbulb className="h-4 w-4 mr-2 text-blue-500" />, "secondary")}
                                    {renderFeedbackSection("Ideal Answer Pointers", feedbackItem.idealAnswerPointers, <CheckSquare className="h-4 w-4 mr-2 text-purple-500" />, "secondary")}
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                    );
                })}
                </Accordion>
             )
          ) : (
            <p className="text-center text-muted-foreground">No questions were asked in this session.</p>
          )}
        </div>

        {(isFeedbackLoading && sessionData.answers.length > 0) && (
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
            <Button onClick={() => sessionData && fetchAndSetFeedback(sessionData)} className="mt-3" variant="outline" size="sm" disabled={!sessionData}>
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

        {sessionData.answers.length === 0 && !isFeedbackLoading && (
             <Alert>
                <AlertTitle>No Answers Recorded</AlertTitle>
                <AlertDescription>
                  It looks like no answers were submitted for this session, so feedback cannot be generated.
                </AlertDescription>
            </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={() => {
            localStorage.removeItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION); 
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

