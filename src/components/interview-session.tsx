
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
import { Loader2, ArrowRight, CheckCircle, XCircle, MessageSquare, TimerIcon, Building, Briefcase } from "lucide-react";
import { LOCAL_STORAGE_KEYS, INTERVIEW_STYLES } from "@/lib/constants";
import type { InterviewSetupData, InterviewSessionData, InterviewQuestion, InterviewStyle, Answer } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { formatMilliseconds } from "@/lib/utils";

const initialSessionState: Omit<InterviewSessionData, keyof InterviewSetupData> & { interviewStyle: InterviewStyle, targetedSkills?: string[], targetCompany?: string, jobTitle?: string } = {
  questions: [],
  answers: [],
  currentQuestionIndex: 0,
  currentQuestionStartTime: undefined,
  isLoading: true,
  error: null,
  interviewStarted: false,
  interviewFinished: false,
  interviewStyle: "simple-qa", 
  targetedSkills: [],
  targetCompany: undefined,
  jobTitle: undefined,
};

export default function InterviewSession() {
  const router = useRouter();
  const { toast } = useToast();
  const [sessionData, setSessionData] = useState<InterviewSessionData | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    let timerInterval: NodeJS.Timeout | undefined;
    if (sessionData?.interviewStarted && !sessionData.interviewFinished && sessionData.currentQuestionStartTime) {
      setCurrentTime(Date.now() - sessionData.currentQuestionStartTime);
      timerInterval = setInterval(() => {
        if (sessionData.currentQuestionStartTime) {
          setCurrentTime(Date.now() - sessionData.currentQuestionStartTime);
        }
      }, 1000);
    }
    return () => clearInterval(timerInterval);
  }, [sessionData?.interviewStarted, sessionData?.interviewFinished, sessionData?.currentQuestionStartTime]);


  const loadInterview = useCallback(async (setupData: InterviewSetupData) => {
    setSessionData(prev => ({
      ...(prev || setupData), 
      ...setupData,          
      ...initialSessionState, 
      isLoading: true,
      interviewStarted: true,
      currentQuestionStartTime: Date.now(), 
    }));

    try {
      const aiInput: CustomizeInterviewQuestionsInput = {
        jobTitle: setupData.jobTitle,
        jobDescription: setupData.jobDescription || "",
        resume: setupData.resume || "",
        interviewType: setupData.interviewType,
        interviewStyle: setupData.interviewStyle,
        faangLevel: setupData.faangLevel,
        targetedSkills: setupData.targetedSkills || [],
        targetCompany: setupData.targetCompany,
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
        const newSession = { 
          ...prev, 
          questions: questionsWithIds, 
          isLoading: false, 
          error: null,
          currentQuestionStartTime: Date.now(), 
        };
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
      if (parsedSession.interviewStarted && !parsedSession.interviewFinished && !parsedSession.currentQuestionStartTime && parsedSession.questions.length > 0) {
        setSessionData(prev => {
          if (!prev) return null;
          const updatedSession = {...prev, currentQuestionStartTime: Date.now()};
          localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(updatedSession));
          return updatedSession;
        });
      }

      if (parsedSession.isLoading && parsedSession.interviewStarted && !parsedSession.error) {
         const setupData: InterviewSetupData = {
          interviewType: parsedSession.interviewType,
          interviewStyle: parsedSession.interviewStyle,
          faangLevel: parsedSession.faangLevel,
          jobTitle: parsedSession.jobTitle,
          jobDescription: parsedSession.jobDescription,
          resume: parsedSession.resume,
          targetedSkills: parsedSession.targetedSkills,
          targetCompany: parsedSession.targetCompany,
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

    const endTime = Date.now();
    const timeTakenMs = sessionData.currentQuestionStartTime ? endTime - sessionData.currentQuestionStartTime : undefined;

    const currentQuestionId = sessionData.questions[sessionData.currentQuestionIndex].id;
    const newAnswer: Answer = { questionId: currentQuestionId, answerText: currentAnswer, timeTakenMs };
    const updatedAnswers = [...sessionData.answers, newAnswer];
    
    let newSessionData: InterviewSessionData;

    if (sessionData.currentQuestionIndex === sessionData.questions.length - 1) {
      newSessionData = {
        ...sessionData,
        answers: updatedAnswers,
        isLoading: false,
        interviewFinished: true,
        currentQuestionStartTime: undefined, 
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
        currentQuestionStartTime: Date.now(), 
      };
      localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(newSessionData));
      setSessionData(newSessionData);
    }
    setCurrentAnswer("");
    setCurrentTime(0); 
  };

  const handleEndInterview = () => {
    if (!sessionData) return;
    
    const endTime = Date.now();
    const timeTakenMs = sessionData.currentQuestionStartTime ? endTime - sessionData.currentQuestionStartTime : undefined;
    
    const currentQuestionId = sessionData.questions.length > 0 && sessionData.currentQuestionIndex < sessionData.questions.length 
                              ? sessionData.questions[sessionData.currentQuestionIndex]?.id 
                              : undefined;
    let updatedAnswers = sessionData.answers;

    if (currentQuestionId && currentAnswer.trim() !== "") {
       const newAnswer: Answer = { questionId: currentQuestionId, answerText: currentAnswer, timeTakenMs };
       updatedAnswers = [...sessionData.answers, newAnswer];
    }
    
    const newSessionData: InterviewSessionData = {
      ...sessionData,
      answers: updatedAnswers,
      isLoading: false,
      interviewFinished: true,
      currentQuestionStartTime: undefined, 
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
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <div>
            {sessionData.jobTitle && (
              <span className="mr-2 flex items-center">
                <Briefcase className="h-4 w-4 mr-1 text-primary" /> Role: {sessionData.jobTitle}
              </span>
            )}
            Level: {sessionData.faangLevel} - Question {sessionData.currentQuestionIndex + 1} of {sessionData.questions.length}
            {sessionData.targetCompany && (
              <span className="ml-2 flex items-center">
                <Building className="h-4 w-4 mr-1 text-primary" /> Target: {sessionData.targetCompany}
              </span>
            )}
          </div>
          {sessionData.interviewStarted && !sessionData.interviewFinished && sessionData.currentQuestionStartTime && sessionData.interviewStyle !== 'take-home' && (
            <div className="flex items-center text-sm text-muted-foreground">
              <TimerIcon className="h-4 w-4 mr-1" />
              {formatMilliseconds(currentTime)}
            </div>
          )}
        </div>
        <Progress value={progress} className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {currentQuestion ? (
          <div>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              {sessionData.interviewStyle === 'take-home' ? 'Take Home Assignment:' : `Question ${sessionData.currentQuestionIndex + 1}:`}
            </h2>
            <p className={`text-lg mb-4 ${sessionData.interviewStyle === 'take-home' ? 'whitespace-pre-wrap p-4 border rounded-md bg-secondary/30' : ''}`}>
                {currentQuestion.text}
            </p>
            <Textarea
              placeholder={sessionData.interviewStyle === 'take-home' ? "Paste your full response here..." : "Type your answer here..."}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              className="min-h-[200px] text-base"
              rows={sessionData.interviewStyle === 'take-home' ? 15 : 8}
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
        <Button 
          onClick={handleNextQuestion} 
          disabled={sessionData.isLoading || !currentAnswer.trim()} 
          className="bg-accent hover:bg-accent/90"
        >
          {sessionData.currentQuestionIndex === sessionData.questions.length - 1 ? "Finish & View Feedback" : "Next Question"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
