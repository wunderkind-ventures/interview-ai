
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { customizeInterviewQuestions } from "@/ai/flows/customize-interview-questions";
import type { CustomizeInterviewQuestionsInput, CustomizeInterviewQuestionsOutput } from "@/ai/flows/customize-interview-questions";
import { generateDynamicCaseFollowUp } from "@/ai/flows/generate-dynamic-case-follow-up";
import type { GenerateDynamicCaseFollowUpInput, GenerateDynamicCaseFollowUpOutput } from "@/ai/flows/generate-dynamic-case-follow-up";
import { explainConcept } from "@/ai/flows/explain-concept"; // Added
import type { ExplainConceptInput, ExplainConceptOutput } from "@/ai/flows/explain-concept"; // Added

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input"; // Added
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"; // Added
import { Loader2, ArrowRight, CheckCircle, XCircle, MessageSquare, TimerIcon, Building, Briefcase, SearchCheck, Layers, Lightbulb, AlertTriangle } from "lucide-react"; // Added Lightbulb, AlertTriangle
import { LOCAL_STORAGE_KEYS, INTERVIEW_STYLES } from "@/lib/constants";
import type { InterviewSetupData, InterviewSessionData, InterviewQuestion, InterviewStyle, Answer } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { formatMilliseconds } from "@/lib/utils";

const MAX_CASE_FOLLOW_UPS = 4; // Max number of follow-ups after the initial question

const initialSessionState: Omit<InterviewSessionData, keyof InterviewSetupData> & { interviewStyle: InterviewStyle, targetedSkills?: string[], targetCompany?: string, jobTitle?: string, interviewFocus?: string } = {
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
  interviewFocus: undefined,
  currentCaseTurnNumber: 0,
  caseConversationHistory: [],
};

export default function InterviewSession() {
  const router = useRouter();
  const { toast } = useToast();
  const [sessionData, setSessionData] = useState<InterviewSessionData | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);

  // State for "Explain Term" feature
  const [isExplainTermDialogOpen, setIsExplainTermDialogOpen] = useState(false);
  const [termToExplainInput, setTermToExplainInput] = useState("");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplainingTerm, setIsExplainingTerm] = useState(false);
  const [explainTermError, setExplainTermError] = useState<string | null>(null);


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
      interviewStyle: setupData.interviewStyle,
      currentCaseTurnNumber: setupData.interviewStyle === 'case-study' ? 0 : undefined,
      caseConversationHistory: setupData.interviewStyle === 'case-study' ? [] : undefined,
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
        interviewFocus: setupData.interviewFocus,
      };
      const response: CustomizeInterviewQuestionsOutput = await customizeInterviewQuestions(aiInput);
      
      if (!response.customizedQuestions || response.customizedQuestions.length === 0) {
        throw new Error("AI did not return any questions. Please try again.");
      }

      const questionsWithIds: InterviewQuestion[] = response.customizedQuestions.map((q, i) => ({
        id: `q-${Date.now()}-${i}`,
        text: q.questionText,
        idealAnswerCharacteristics: q.idealAnswerCharacteristics,
        isInitialCaseQuestion: q.isInitialCaseQuestion,
        fullScenarioDescription: q.fullScenarioDescription,
        internalNotesForFollowUpGenerator: q.internalNotesForFollowUpGenerator,
        isLikelyFinalFollowUp: false, 
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
      if (parsedSession.interviewStyle === 'case-study') {
        parsedSession.currentCaseTurnNumber = parsedSession.currentCaseTurnNumber ?? 0;
        parsedSession.caseConversationHistory = parsedSession.caseConversationHistory ?? [];
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
      
      if (parsedSession.interviewStarted && parsedSession.questions.length === 0 && !parsedSession.error && !parsedSession.isLoading) {
         const setupData: InterviewSetupData = {
          interviewType: parsedSession.interviewType,
          interviewStyle: parsedSession.interviewStyle,
          faangLevel: parsedSession.faangLevel,
          jobTitle: parsedSession.jobTitle,
          jobDescription: parsedSession.jobDescription,
          resume: parsedSession.resume,
          targetedSkills: parsedSession.targetedSkills,
          targetCompany: parsedSession.targetCompany,
          interviewFocus: parsedSession.interviewFocus,
        };
        loadInterview(setupData);
      } else if (parsedSession.isLoading && parsedSession.interviewStarted && !parsedSession.error) {
         const setupData: InterviewSetupData = {
          interviewType: parsedSession.interviewType,
          interviewStyle: parsedSession.interviewStyle,
          faangLevel: parsedSession.faangLevel,
          jobTitle: parsedSession.jobTitle,
          jobDescription: parsedSession.jobDescription,
          resume: parsedSession.resume,
          targetedSkills: parsedSession.targetedSkills,
          targetCompany: parsedSession.targetCompany,
          interviewFocus: parsedSession.interviewFocus,
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

  const handleNextQuestion = async () => {
    if (!sessionData || sessionData.currentQuestionIndex >= sessionData.questions.length) return;
    if (isGeneratingFollowUp) return;

    const endTime = Date.now();
    const timeTakenMs = sessionData.currentQuestionStartTime ? endTime - sessionData.currentQuestionStartTime : undefined;

    const currentQ = sessionData.questions[sessionData.currentQuestionIndex];
    const newAnswer: Answer = { questionId: currentQ.id, answerText: currentAnswer, timeTakenMs };
    
    let updatedAnswers = [...sessionData.answers, newAnswer];
    let newSessionData: InterviewSessionData | null = null;

    if (sessionData.interviewStyle === 'case-study') {
      setIsGeneratingFollowUp(true);
      const updatedCaseConversationHistory = [...(sessionData.caseConversationHistory || []), { questionText: currentQ.text, answerText: currentAnswer }];
      const updatedCurrentCaseTurnNumber = (sessionData.currentCaseTurnNumber || 0) + 1;

      const isLastFollowUp = currentQ.isLikelyFinalFollowUp || updatedCurrentCaseTurnNumber > MAX_CASE_FOLLOW_UPS;

      if (isLastFollowUp) {
        newSessionData = {
          ...sessionData,
          answers: updatedAnswers,
          caseConversationHistory: updatedCaseConversationHistory,
          currentCaseTurnNumber: updatedCurrentCaseTurnNumber,
          isLoading: false,
          interviewFinished: true,
          currentQuestionStartTime: undefined,
        };
        toast({ title: "Case Study Complete!", description: "Redirecting to feedback page." });
      } else {
        try {
          const initialQuestion = sessionData.questions.find(q => q.isInitialCaseQuestion);
          if (!initialQuestion || !initialQuestion.internalNotesForFollowUpGenerator) {
            throw new Error("Initial case study setup notes not found.");
          }

          const followUpInput: GenerateDynamicCaseFollowUpInput = {
            internalNotesFromInitialScenario: initialQuestion.internalNotesForFollowUpGenerator,
            previousQuestionText: currentQ.text,
            previousUserAnswerText: currentAnswer,
            conversationHistory: updatedCaseConversationHistory,
            interviewContext: { 
              interviewType: sessionData.interviewType,
              interviewStyle: sessionData.interviewStyle,
              faangLevel: sessionData.faangLevel,
              jobTitle: sessionData.jobTitle,
              jobDescription: sessionData.jobDescription,
              resume: sessionData.resume,
              targetedSkills: sessionData.targetedSkills,
              targetCompany: sessionData.targetCompany,
              interviewFocus: sessionData.interviewFocus,
            },
            currentTurnNumber: updatedCurrentCaseTurnNumber,
          };

          const followUpResponse: GenerateDynamicCaseFollowUpOutput = await generateDynamicCaseFollowUp(followUpInput);
          
          const newFollowUpQ: InterviewQuestion = {
            id: `q-${Date.now()}-fu-${updatedCurrentCaseTurnNumber}`,
            text: followUpResponse.followUpQuestionText,
            idealAnswerCharacteristics: followUpResponse.idealAnswerCharacteristicsForFollowUp,
            isLikelyFinalFollowUp: followUpResponse.isLikelyFinalFollowUp,
          };

          newSessionData = {
            ...sessionData,
            answers: updatedAnswers,
            questions: [...sessionData.questions, newFollowUpQ],
            currentQuestionIndex: sessionData.currentQuestionIndex + 1,
            isLoading: false,
            currentQuestionStartTime: Date.now(),
            currentCaseTurnNumber: updatedCurrentCaseTurnNumber,
            caseConversationHistory: updatedCaseConversationHistory,
          };

        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Failed to generate follow-up question.";
          toast({ title: "Error", description: errorMessage, variant: "destructive" });
          newSessionData = { ...sessionData, answers: updatedAnswers, isLoading: false, error: errorMessage }; 
        }
      }
      setIsGeneratingFollowUp(false);
    } else { 
      if (sessionData.currentQuestionIndex === sessionData.questions.length - 1) {
        newSessionData = {
          ...sessionData,
          answers: updatedAnswers,
          isLoading: false,
          interviewFinished: true,
          currentQuestionStartTime: undefined,
        };
        toast({ title: "Interview Complete!", description: "Redirecting to feedback page." });
      } else {
        newSessionData = {
          ...sessionData,
          answers: updatedAnswers,
          currentQuestionIndex: sessionData.currentQuestionIndex + 1,
          isLoading: false,
          currentQuestionStartTime: Date.now(),
        };
      }
    }

    if (newSessionData) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(newSessionData));
      setSessionData(newSessionData);
      if (newSessionData.interviewFinished) {
        router.push("/feedback");
      }
    }
    setCurrentAnswer("");
    setCurrentTime(0);
  };

  const handleEndInterview = () => {
    if (!sessionData) return;
    
    const endTime = Date.now();
    const timeTakenMs = sessionData.currentQuestionStartTime ? endTime - sessionData.currentQuestionStartTime : undefined;
    
    const currentQ = sessionData.questions.length > 0 && sessionData.currentQuestionIndex < sessionData.questions.length
                              ? sessionData.questions[sessionData.currentQuestionIndex]
                              : undefined;
    let updatedAnswers = sessionData.answers;
    let updatedCaseHistory = sessionData.caseConversationHistory;

    if (currentQ && currentAnswer.trim() !== "") {
       const newAnswer: Answer = { questionId: currentQ.id, answerText: currentAnswer, timeTakenMs };
       updatedAnswers = [...sessionData.answers, newAnswer];
       if (sessionData.interviewStyle === 'case-study') {
         updatedCaseHistory = [...(sessionData.caseConversationHistory || []), { questionText: currentQ.text, answerText: currentAnswer }];
       }
    }
    
    const newSessionData: InterviewSessionData = {
      ...sessionData,
      answers: updatedAnswers,
      caseConversationHistory: updatedCaseHistory,
      isLoading: false,
      interviewFinished: true,
      currentQuestionStartTime: undefined,
    };
    localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(newSessionData));
    setSessionData(newSessionData);
    toast({ title: "Interview Ended", description: "Redirecting to feedback page." });
    router.push("/feedback");
  };

  const handleExplainTermSubmit = async () => {
    if (!termToExplainInput.trim() || !sessionData) return;
    setIsExplainingTerm(true);
    setExplainTermError(null);
    setExplanation(null);
    try {
      const input: ExplainConceptInput = {
        term: termToExplainInput,
        interviewContext: sessionData.interviewType,
      };
      const result: ExplainConceptOutput = await explainConcept(input);
      setExplanation(result.explanation);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to get explanation.";
      setExplainTermError(errorMsg);
      toast({ title: "Explanation Error", description: errorMsg, variant: "destructive" });
    } finally {
      setIsExplainingTerm(false);
    }
  };

  const openExplainTermDialog = () => {
    setTermToExplainInput("");
    setExplanation(null);
    setExplainTermError(null);
    setIsExplainTermDialogOpen(true);
  };


  if (!sessionData || (sessionData.isLoading && !sessionData.questions.length && !isGeneratingFollowUp)) {
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
  const styleLabel = INTERVIEW_STYLES.find(s => s.value === sessionData.interviewStyle)?.label || sessionData.interviewStyle;
  
  const isCaseStudyStyle = sessionData.interviewStyle === 'case-study';
  const progressValue = isCaseStudyStyle 
    ? ((sessionData.currentCaseTurnNumber || 0) / (MAX_CASE_FOLLOW_UPS +1)) * 100 
    : (sessionData.questions.length > 0 ? ((sessionData.currentQuestionIndex + 1) / sessionData.questions.length) * 100 : 0);


  return (
    <>
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <MessageSquare className="mr-3 h-7 w-7 text-primary" />
          Interview: {sessionData.interviewType} ({styleLabel})
        </CardTitle>
        <div className="flex flex-wrap justify-between items-center text-sm text-muted-foreground gap-y-1">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {sessionData.jobTitle && (
              <span className="flex items-center">
                <Briefcase className="h-4 w-4 mr-1 text-primary" /> Role: {sessionData.jobTitle}
              </span>
            )}
            <span>Level: {sessionData.faangLevel}</span>
            {isCaseStudyStyle ? (
              <span className="flex items-center">
                <Layers className="h-4 w-4 mr-1 text-primary" />
                Turn: {(sessionData.currentCaseTurnNumber || 0) + 1}
              </span>
            ) : (
               <span>Question {sessionData.currentQuestionIndex + 1} of {sessionData.questions.length}</span>
            )}
            {sessionData.targetCompany && (
              <span className="flex items-center">
                <Building className="h-4 w-4 mr-1 text-primary" /> Target: {sessionData.targetCompany}
              </span>
            )}
            {sessionData.interviewFocus && (
              <span className="flex items-center">
                <SearchCheck className="h-4 w-4 mr-1 text-primary" /> Focus: {sessionData.interviewFocus}
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
        <Progress value={progressValue} className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {isGeneratingFollowUp && (
          <div className="flex flex-col items-center justify-center min-h-[100px]">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-lg text-muted-foreground">Generating next follow-up question...</p>
          </div>
        )}
        {!isGeneratingFollowUp && currentQuestion ? (
          <div>
            {currentQuestion.isInitialCaseQuestion && currentQuestion.fullScenarioDescription && (
              <div className="mb-6 p-4 border rounded-md bg-secondary/30">
                <h3 className="text-lg font-semibold mb-2 text-primary">Case Scenario:</h3>
                <p className="whitespace-pre-wrap text-base">{currentQuestion.fullScenarioDescription}</p>
              </div>
            )}
            <h2 className="text-xl font-semibold mb-1 text-foreground">
              {sessionData.interviewStyle === 'take-home' ? 'Take Home Assignment:' : 
               currentQuestion.isInitialCaseQuestion ? 'Initial Question:' :
               isCaseStudyStyle ? `Follow-up Question (Turn ${(sessionData.currentCaseTurnNumber || 0) + 1}):` :
               `Question ${sessionData.currentQuestionIndex + 1}:`}
            </h2>
             <p className={`text-lg mb-3 ${sessionData.interviewStyle === 'take-home' ? 'whitespace-pre-wrap p-4 border rounded-md bg-secondary/30' : ''}`}>
                {currentQuestion.text}
            </p>
            <Button variant="ghost" size="sm" onClick={openExplainTermDialog} className="mb-3 text-xs text-muted-foreground hover:text-primary">
              <Lightbulb className="mr-1.5 h-3.5 w-3.5" /> Explain a concept from this question
            </Button>
            <Textarea
              placeholder={sessionData.interviewStyle === 'take-home' ? "Paste your full response here..." : "Type your answer here..."}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              className="min-h-[200px] text-base"
              rows={sessionData.interviewStyle === 'take-home' ? 15 : 8}
              disabled={isGeneratingFollowUp}
            />
          </div>
        ) : !isGeneratingFollowUp && (
          <p>No questions available or loading follow-up. This might be an error if not in a case study.</p>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleEndInterview} disabled={sessionData.isLoading || isGeneratingFollowUp}>
          End Interview
        </Button>
        <Button
          onClick={handleNextQuestion}
          disabled={sessionData.isLoading || !currentAnswer.trim() || isGeneratingFollowUp}
          className="bg-accent hover:bg-accent/90"
        >
          {isGeneratingFollowUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {sessionData.interviewStyle === 'case-study' 
            ? (currentQuestion?.isLikelyFinalFollowUp || (sessionData.currentCaseTurnNumber || 0) >= MAX_CASE_FOLLOW_UPS ? "Finish Case & View Feedback" : "Submit & Get Next Follow-up")
            : (sessionData.currentQuestionIndex === sessionData.questions.length - 1 ? "Finish & View Feedback" : "Next Question")
          }
          {!isGeneratingFollowUp && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </CardFooter>
    </Card>

    <Dialog open={isExplainTermDialogOpen} onOpenChange={setIsExplainTermDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Lightbulb className="mr-2 h-5 w-5 text-primary" /> Explain a Term/Concept
            </DialogTitle>
            <DialogDescription>
              Enter a term or concept from the current interview question that you'd like explained.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="e.g., CAP Theorem, STAR method, Microservices"
              value={termToExplainInput}
              onChange={(e) => setTermToExplainInput(e.target.value)}
            />
            {isExplainingTerm && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Getting explanation...
              </div>
            )}
            {explainTermError && !isExplainingTerm && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{explainTermError}</AlertDescription>
              </Alert>
            )}
            {explanation && !isExplainingTerm && (
              <Alert variant="default" className="bg-emerald-50 border-emerald-200">
                <Lightbulb className="h-4 w-4 text-emerald-600" />
                <AlertTitle className="text-emerald-700">Explanation</AlertTitle>
                <AlertDescription className="text-emerald-700">
                  {explanation}
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="sm:justify-end">
             <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleExplainTermSubmit} disabled={isExplainingTerm || !termToExplainInput.trim()}>
              {isExplainingTerm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchCheck className="mr-2 h-4 w-4" /> }
              Get Explanation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
