
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { customizeInterviewQuestions } from "@/ai/flows/customize-interview-questions";
import type { CustomizeInterviewQuestionsInput } from "@/ai/flows/customize-interview-questions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ArrowRight, CheckCircle, XCircle, MessageSquare } from "lucide-react";
import { LOCAL_STORAGE_KEYS, INTERVIEW_STYLES } from "@/lib/constants";
import type { InterviewSetupData, InterviewSessionData, InterviewQuestion, InterviewStyle } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const initialSessionState: Omit<InterviewSessionData, keyof InterviewSetupData> & { interviewStyle: InterviewStyle } = {
  questions: [],
  answers: [],
  currentQuestionIndex: 0,
  isLoading: true,
  error: null,
  interviewStarted: false,
  interviewFinished: false,
  interviewStyle: "simple-qa", // Default, will be overridden by setup or stored session
};

export default function InterviewSession() {
  const router = useRouter();
  const { toast } = useToast();
  const [sessionData, setSessionData] = useState<InterviewSessionData | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState("");

  const loadInterview = useCallback(async (setupData: InterviewSetupData) => {
    setSessionData(prev => ({
      ...(prev || setupData), // Start with previous or new setup data
      ...setupData,           // Ensure current setupData overwrites
      ...initialSessionState, // Apply initial session state (resets questions, index, etc.)
      isLoading: true,
      interviewStarted: true,
    }));

    try {
      const aiInput: CustomizeInterviewQuestionsInput = {
        jobDescription: setupData.jobDescription || "",
        resume: setupData.resume || "",
        interviewType: setupData.interviewType,
        interviewStyle: setupData.interviewStyle,
        faangLevel: setupData.faangLevel,
      };
      const response = await customizeInterviewQuestions(aiInput);
      
      if (!response.customizedQuestions || response.customizedQuestions.length === 0) {
        throw new Error("AI did not return any questions. Please try again.");
      }

      const questionsWithIds: InterviewQuestion[] = response.customizedQuestions.map((q, i) => ({
        id: `q-${Date.now()}-${i}`,
        text: q,
      }));

      setSessionData(prev => {
        if (!prev) return null; 
        const newSession = { ...prev, questions: questionsWithIds, isLoading: false, error: null };
        localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(newSession));
        return newSession;
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred while fetching questions.";
      toast({
        title: "Error fetching questions",
        description: errorMessage,
        variant: "destructive",
      });
      setSessionData(prev => {
        if (!prev) return null;
        const newSession = { ...prev, isLoading: false, error: errorMessage };
        localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(newSession));
        return newSession;
      });
    }
  }, [toast]);

  useEffect(() => {
    const storedSession = localStorage.getItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION);
    if (storedSession) {
      const parsedSession: InterviewSessionData = JSON.parse(storedSession);
      if (parsedSession.interviewFinished) {
        router.replace("/feedback");
        return;
      }
      setSessionData(parsedSession);
      if (parsedSession.isLoading && parsedSession.interviewStarted && !parsedSession.error) {
         const setupData: InterviewSetupData = {
          interviewType: parsedSession.interviewType,
          interviewStyle: parsedSession.interviewStyle,
          faangLevel: parsedSession.faangLevel,
          jobDescription: parsedSession.jobDescription,
          resume: parsedSession.resume,
        };
        loadInterview(setupData);
      }
    } else {
      const storedSetup = localStorage.getItem(LOCAL_STORAGE_KEYS.INTERVIEW_SETUP);
      if (storedSetup) {
        const setupData: InterviewSetupData = JSON.parse(storedSetup);
        loadInterview(setupData);
      } else {
        toast({ title: "Setup required", description: "Please configure your interview first.", variant: "destructive"});
        router.replace("/");
      }
    }
  }, [loadInterview, router, toast]);

  const handleNextQuestion = () => {
    if (!sessionData || sessionData.currentQuestionIndex >= sessionData.questions.length) return;

    const currentQuestionId = sessionData.questions[sessionData.currentQuestionIndex].id;
    const updatedAnswers = [...sessionData.answers, { questionId: currentQuestionId, answerText: currentAnswer }];
    
    let newSessionData: InterviewSessionData;

    if (sessionData.currentQuestionIndex === sessionData.questions.length - 1) {
      newSessionData = {
        ...sessionData,
        answers: updatedAnswers,
        isLoading: false,
        interviewFinished: true,
      };
      toast({ title: "Interview Complete!", description: "Redirecting to feedback page." });
      localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(newSessionData));
      setSessionData(newSessionData);
      router.push("/feedback");
    } else {
      newSessionData = {
        ...sessionData,
        answers: updatedAnswers,
        currentQuestionIndex: sessionData.currentQuestionIndex + 1,
        isLoading: false, 
      };
      localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(newSessionData));
      setSessionData(newSessionData);
    }
    setCurrentAnswer("");
  };

  const handleEndInterview = () => {
    if (!sessionData) return;
    const currentQuestionId = sessionData.questions.length > 0 ? sessionData.questions[sessionData.currentQuestionIndex]?.id : undefined;
    let updatedAnswers = sessionData.answers;

    if (currentQuestionId && currentAnswer.trim() !== "") {
       updatedAnswers = [...sessionData.answers, { questionId: currentQuestionId, answerText: currentAnswer }];
    }
    
    const newSessionData: InterviewSessionData = {
      ...sessionData,
      answers: updatedAnswers,
      isLoading: false,
      interviewFinished: true,
    };
    localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(newSessionData));
    setSessionData(newSessionData);
    toast({ title: "Interview Ended", description: "Redirecting to feedback page." });
    router.push("/feedback");
  };


  if (!sessionData || (sessionData.isLoading && !sessionData.questions.length)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Preparing your interview...</p>
      </div>
    );
  }

  if (sessionData.error) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <XCircle className="h-5 w-5" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{sessionData.error}</AlertDescription>
        <Button onClick={() => router.push("/")} className="mt-4">Back to Setup</Button>
      </Alert>
    );
  }
  
  if (sessionData.interviewFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <p className="text-xl text-muted-foreground">Interview finished. Redirecting to feedback...</p>
      </div>
    );
  }

  const currentQuestion = sessionData.questions[sessionData.currentQuestionIndex];
  const progress = sessionData.questions.length > 0 ? ((sessionData.currentQuestionIndex + 1) / sessionData.questions.length) * 100 : 0;
  const styleLabel = INTERVIEW_STYLES.find(s => s.value === sessionData.interviewStyle)?.label || sessionData.interviewStyle;

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <MessageSquare className="mr-3 h-7 w-7 text-primary" />
          Interview: {sessionData.interviewType} ({styleLabel})
        </CardTitle>
        <CardDescription>
          Level: {sessionData.faangLevel} - Question {sessionData.currentQuestionIndex + 1} of {sessionData.questions.length}
        </CardDescription>
        <Progress value={progress} className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {currentQuestion ? (
          <div>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              {currentQuestion.text}
            </h2>
            <Textarea
              placeholder="Type your answer here..."
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              className="min-h-[200px] text-base"
              rows={8}
            />
          </div>
        ) : (
          <p>No questions available. This might be an error.</p>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleEndInterview} disabled={sessionData.isLoading}>
          End Interview
        </Button>
        <Button onClick={handleNextQuestion} disabled={sessionData.isLoading || !currentAnswer.trim()} className="bg-accent hover:bg-accent/90">
          {sessionData.currentQuestionIndex === sessionData.questions.length - 1 ? "Finish &amp; View Feedback" : "Next Question"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
