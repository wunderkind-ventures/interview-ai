"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { customizeInterviewQuestions } from "@/ai/flows/customize-interview-questions";
import type { CustomizeInterviewQuestionsOutput, CustomizeInterviewQuestionsInput } from "@/ai/flows/customize-interview-questions";
import { executeBYOKFlow } from "@/lib/byok-flows-api";
import { generateDynamicCaseFollowUp } from "@/ai/flows/generate-dynamic-case-follow-up";
import type { GenerateDynamicCaseFollowUpInput, GenerateDynamicCaseFollowUpOutput } from "@/ai/flows/generate-dynamic-case-follow-up";
import { explainConcept } from "@/ai/flows/explain-concept";
import type { ExplainConceptInput, ExplainConceptOutput } from "@/ai/flows/explain-concept";
import { generateHint } from "@/ai/flows/generate-hint";
import type { GenerateHintInput, GenerateHintOutput } from "@/ai/flows/generate-hint";
import { generateSampleAnswer } from "@/ai/flows/generate-sample-answer";
import type { GenerateSampleAnswerInput, GenerateSampleAnswerOutput } from "@/ai/flows/generate-sample-answer";
import { clarifyInterviewQuestion } from "@/ai/flows/clarify-interview-question";
import type { ClarifyInterviewQuestionInput, ClarifyInterviewQuestionOutput } from "@/ai/flows/clarify-interview-question";


import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, ArrowRight, CheckCircle, XCircle, MessageSquare, TimerIcon, Building, Briefcase, SearchCheck, Layers, Lightbulb, AlertTriangle, Star, StickyNote, Sparkles, History, Mic, MicOff, BookOpen, HelpCircle, MoreVertical, UserCheck2, MessageCircleQuestion } from "lucide-react";
import { LOCAL_STORAGE_KEYS, INTERVIEW_STYLES, INTERVIEWER_PERSONAS, type InterviewStyle, type InterviewerPersona, type RoleType, SKILLS_BY_ROLE, SKILLS_BY_INTERVIEW_TYPE } from "@/lib/constants";
import type { InterviewSetupData, InterviewSessionData, InterviewQuestion, Answer } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { formatMilliseconds } from "@/lib/utils";

const MAX_CASE_FOLLOW_UPS = 4;

const initialSessionState: Omit<InterviewSessionData, keyof InterviewSetupData> & { interviewStyle: InterviewStyle, roleType?: RoleType, targetedSkills?: string[], targetCompany?: string, jobTitle?: string, interviewFocus?: string, interviewerPersona?: InterviewerPersona | string, caseStudyNotes?: string, previousConversation?: string } = {
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
  interviewerPersona: INTERVIEWER_PERSONAS[0].value,
  currentCaseTurnNumber: 0,
  caseConversationHistory: [],
  caseStudyNotes: "",
  sampleAnswers: {},
  previousConversation: "",
};

interface CustomSpeechRecognition extends SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
}

export default function InterviewSession() {
  const router = useRouter();
  const { toast } = useToast();
  const [sessionData, setSessionData] = useState<InterviewSessionData | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);
  const [currentConfidenceScore, setCurrentConfidenceScore] = useState<number | null>(null);

  const [isExplainTermDialogOpen, setIsExplainTermDialogOpen] = useState(false);
  const [termToExplainInput, setTermToExplainInput] = useState("");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplainingTerm, setIsExplainingTerm] = useState(false);
  const [explainTermError, setExplainTermError] = useState<string | null>(null);

  const [isHintDialogOpen, setIsHintDialogOpen] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [isFetchingHint, setIsFetchingHint] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);

  const [isSampleAnswerDialogOpen, setIsSampleAnswerDialogOpen] = useState(false);
  const [sampleAnswerText, setSampleAnswerText] = useState<string | null>(null);
  const [isFetchingSampleAnswer, setIsFetchingSampleAnswer] = useState(false);
  const [sampleAnswerError, setSampleAnswerError] = useState<string | null>(null);

  const [isClarifyQuestionDialogOpen, setIsClarifyQuestionDialogOpen] = useState(false);
  const [userClarifyingQuestionInput, setUserClarifyingQuestionInput] = useState("");
  const [clarificationForQuestion, setClarificationForQuestion] = useState<string | null>(null);
  const [isFetchingQuestionClarification, setIsFetchingQuestionClarification] = useState(false);
  const [questionClarificationError, setQuestionClarificationError] = useState<string | null>(null);


  const [isRecording, setIsRecording] = useState(false);
  const [isSpeechApiSupported, setIsSpeechApiSupported] = useState(false);
  const [micPermissionStatus, setMicPermissionStatus] = useState<'idle' | 'pending' | 'granted' | 'denied'>('idle');
  const recognitionRef = useRef<CustomSpeechRecognition | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setIsSpeechApiSupported(true);
    } else {
      setIsSpeechApiSupported(false);
      console.warn("Web Speech API is not supported in this browser.");
    }
  }, []);
  
  useEffect(() => {
    if (isSpeechApiSupported && recognitionRef.current) {
      const recognition = recognitionRef.current;
      
      recognition.onstart = () => {
        setIsRecording(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscriptSegment = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscriptSegment += event.results[i][0].transcript;
          }
        }
        if (finalTranscriptSegment) {
          setCurrentAnswer((prev) => prev + (prev.endsWith(' ') || prev === '' || finalTranscriptSegment.startsWith(' ') ? '' : ' ') + finalTranscriptSegment);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error", event.error);
        let errorMessage = `Speech recognition error: ${event.error}.`;
        if (event.error === 'no-speech') {
            errorMessage = 'No speech was detected. Please try again.';
        } else if (event.error === 'audio-capture') {
            errorMessage = 'Audio capture failed. Ensure your microphone is working.';
        } else if (event.error === 'not-allowed') {
            errorMessage = 'Microphone access was denied. Please enable it in your browser settings.';
            setMicPermissionStatus('denied');
        }
        setSpeechError(errorMessage);
        toast({ title: "Transcription Error", description: errorMessage, variant: "destructive" });
        setIsRecording(false); 
      };

      recognition.onend = () => {
        setIsRecording(false);
      };
    }
  }, [isSpeechApiSupported, toast]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current = null;
      }
    };
  }, []);


  const requestMicrophonePermission = async () => {
    if (micPermissionStatus === 'granted') return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({ title: "Unsupported Browser", description: "Microphone access is not supported by your browser.", variant: "destructive" });
      setMicPermissionStatus('denied'); 
      return false;
    }
    setMicPermissionStatus('pending');
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermissionStatus('granted');
      toast({ title: "Microphone Access Granted", description: "You can now record your answers.", variant: "default" });
      return true;
    } catch (error) {
      console.error("Error accessing microphone:", error);
      setMicPermissionStatus('denied');
      toast({
        variant: 'destructive',
        title: 'Microphone Access Denied',
        description: 'Please enable microphone permissions in your browser settings to record answers.',
      });
      return false;
    }
  };

  const handleToggleRecording = async () => {
    if (!isSpeechApiSupported) {
      toast({ title: "Feature Not Supported", description: "Speech-to-text is not supported in your browser.", variant: "destructive" });
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    } else {
      const hasPermission = await requestMicrophonePermission();
      if (hasPermission) {
        if (!recognitionRef.current) {
          const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          recognitionRef.current = new SpeechRecognitionAPI() as CustomSpeechRecognition;
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = false; 
          recognitionRef.current.lang = 'en-US';
          
          recognitionRef.current.onstart = () => { setIsRecording(true); setSpeechError(null); };
          recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscriptSegment = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscriptSegment += event.results[i][0].transcript;
              }
            }
            if (finalTranscriptSegment) {
              setCurrentAnswer((prev) => prev + (prev.endsWith(' ') || prev === '' || finalTranscriptSegment.startsWith(' ') ? '' : ' ') + finalTranscriptSegment);
            }
          };
          recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error("Speech recognition error", event.error);
            let errorMessage = `Speech recognition error: ${event.error}.`;
            if (event.error === 'no-speech') {
                errorMessage = 'No speech was detected. Please try again.';
            } else if (event.error === 'audio-capture') {
                errorMessage = 'Audio capture failed. Ensure your microphone is working.';
            } else if (event.error === 'not-allowed') {
                errorMessage = 'Microphone access was denied or revoked.';
                setMicPermissionStatus('denied');
            }
            setSpeechError(errorMessage);
            toast({ title: "Transcription Error", description: errorMessage, variant: "destructive" });
            setIsRecording(false);
          };
          recognitionRef.current.onend = () => { setIsRecording(false); };
        }
        try {
          recognitionRef.current.start();
        } catch (e) {
            console.error("Error starting recognition:", e);
            toast({title: "Recording Error", description: "Could not start recording. Please try again.", variant: "destructive"});
            setIsRecording(false);
        }
      }
    }
  };


  useEffect(() => {
    let timerInterval: NodeJS.Timeout | undefined;
    if (sessionData?.interviewStarted && !sessionData.interviewFinished && sessionData.currentQuestionStartTime) {
      setCurrentTime(Date.now() - sessionData.currentQuestionStartTime);
      timerInterval = setInterval(() => {
        if (sessionData?.currentQuestionStartTime) { 
          setCurrentTime(Date.now() - sessionData.currentQuestionStartTime);
        }
      }, 1000);
    }
    return () => clearInterval(timerInterval);
  }, [sessionData?.interviewStarted, sessionData?.interviewFinished, sessionData?.currentQuestionStartTime]);


  const loadInterview = useCallback(async (setupData: InterviewSetupData) => {
    let skillsForPrompt: string[] = [];
    if (setupData.roleType && SKILLS_BY_ROLE[setupData.roleType] && SKILLS_BY_ROLE[setupData.roleType].length > 0) {
      skillsForPrompt = SKILLS_BY_ROLE[setupData.roleType].map(skill => skill.value);
    } else if (setupData.targetedSkills && setupData.targetedSkills.length > 0) {
      skillsForPrompt = setupData.targetedSkills;
    } else if (setupData.interviewType && SKILLS_BY_INTERVIEW_TYPE[setupData.interviewType]) {
      skillsForPrompt = SKILLS_BY_INTERVIEW_TYPE[setupData.interviewType].map(skill => skill.value);
    }

     const saneInput: CustomizeInterviewQuestionsInput = {
        jobTitle: setupData.jobTitle || "",
        jobDescription: setupData.jobDescription || "",
        resume: setupData.resume || "",
        interviewType: setupData.interviewType,
        interviewStyle: setupData.interviewStyle,
        faangLevel: setupData.faangLevel,
        targetedSkills: skillsForPrompt,
        targetCompany: setupData.targetCompany || "",
        interviewFocus: setupData.interviewFocus || "",
        interviewerPersona: setupData.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
        previousConversation: "", 
        currentQuestion: "",    
        caseStudyNotes: setupData.interviewStyle === 'case-study' ? (sessionData?.caseStudyNotes || "") : "",
      };

    setSessionData(prev => ({
      ...(prev || setupData),
      ...setupData,
      ...initialSessionState, 
      roleType: setupData.roleType,
      isLoading: true,
      interviewStarted: true,
      currentQuestionStartTime: Date.now(),
      interviewStyle: setupData.interviewStyle,
      interviewerPersona: setupData.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
      currentCaseTurnNumber: setupData.interviewStyle === 'case-study' ? 0 : undefined,
      caseConversationHistory: setupData.interviewStyle === 'case-study' ? [] : undefined,
      caseStudyNotes: setupData.interviewStyle === 'case-study' ? (prev?.caseStudyNotes || "") : "",
      previousConversation: "",
      targetedSkills: setupData.targetedSkills || [],
      targetCompany: setupData.targetCompany || "",
      jobTitle: setupData.jobTitle || "",
      interviewFocus: setupData.interviewFocus || "",
      sampleAnswers: prev?.sampleAnswers || {}, 
    }));

    try {
      // Use BYOK flow if backend URL is configured, otherwise use direct flow
      const response: CustomizeInterviewQuestionsOutput = process.env.NEXT_PUBLIC_GO_BACKEND_URL
        ? await executeBYOKFlow<any, CustomizeInterviewQuestionsOutput>('customizeInterviewQuestions', saneInput)
        : await customizeInterviewQuestions(saneInput);

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
        isLikelyFinalFollowUp: q.isLikelyFinalFollowUp || false, 
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
  }, [toast, sessionData?.caseStudyNotes]);

  useEffect(() => {
    let storedSessionJson = localStorage.getItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION);
    let parsedSession: InterviewSessionData | null = null;

    if (storedSessionJson) {
      try {
        parsedSession = JSON.parse(storedSessionJson);
      } catch (e) {
        console.error("Failed to parse stored interview session:", e);
        toast({ title: "Session Error", description: "Corrupted session data. Please configure your interview again.", variant: "destructive"});
        localStorage.removeItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION);
        storedSessionJson = null; 
      }
    }
    
    const currentSession = parsedSession;

    if (currentSession) {
      if (currentSession.interviewFinished) {
        router.replace("/feedback");
        return;
      }
      currentSession.interviewerPersona = currentSession.interviewerPersona || INTERVIEWER_PERSONAS[0].value;
      currentSession.currentCaseTurnNumber = currentSession.interviewStyle === 'case-study' ? (currentSession.currentCaseTurnNumber ?? 0) : undefined;
      currentSession.caseConversationHistory = currentSession.interviewStyle === 'case-study' ? (currentSession.caseConversationHistory ?? []) : undefined;
      currentSession.caseStudyNotes = currentSession.interviewStyle === 'case-study' ? (currentSession.caseStudyNotes ?? "") : "";
      currentSession.sampleAnswers = currentSession.sampleAnswers ?? {};
      currentSession.previousConversation = currentSession.previousConversation ?? "";

      setSessionData(currentSession);
      if (currentSession.interviewStarted && !currentSession.interviewFinished && !currentSession.currentQuestionStartTime && currentSession.questions.length > 0) {
        setSessionData(prev => {
          if (!prev) return null;
          const updatedSession = {...prev, currentQuestionStartTime: Date.now()};
          localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(updatedSession));
          return updatedSession;
        });
      } else if (currentSession.interviewStarted && 
                 ( (currentSession.questions.length === 0 && !currentSession.error && !currentSession.isLoading) || 
                   (currentSession.isLoading && !currentSession.error) ) ) {
        // This block executes if the interview has started but questions are missing/still loading.
        // We need to re-trigger loadInterview with the setup data derived from currentSession.
        
        // Since we are inside the if (currentSession) block, currentSession is not null here.
        const setupDataForReload: InterviewSetupData = {
          interviewType: currentSession.interviewType,
          interviewStyle: currentSession.interviewStyle,
          faangLevel: currentSession.faangLevel,
          roleType: currentSession.roleType, 
          jobTitle: currentSession.jobTitle,
          jobDescription: currentSession.jobDescription,
          resume: currentSession.resume,
          targetedSkills: currentSession.targetedSkills,
          targetCompany: currentSession.targetCompany,
          interviewFocus: currentSession.interviewFocus,
          interviewerPersona: currentSession.interviewerPersona,
          selectedThemeId: currentSession.selectedThemeId,
          caseStudyNotes: currentSession.caseStudyNotes,
        };
        loadInterview(setupDataForReload);
      }
    } else {
      const storedSetup = localStorage.getItem(LOCAL_STORAGE_KEYS.INTERVIEW_SETUP);
      if (storedSetup) {
        try {
          const setupData: InterviewSetupData = JSON.parse(storedSetup);
          loadInterview(setupData);
        } catch (e) {
            console.error("Failed to parse stored interview setup:", e);
            localStorage.removeItem(LOCAL_STORAGE_KEYS.INTERVIEW_SETUP);
            toast({ title: "Setup required", description: "Corrupted setup data. Please configure your interview again.", variant: "destructive"});
            router.replace("/");
        }
      } else {
        toast({ title: "Setup required", description: "Please configure your interview first.", variant: "destructive"});
        router.replace("/");
      }
    }
  }, [loadInterview, router, toast]);

  const handleNextQuestion = async () => {
    if (!sessionData || !sessionData.questions || sessionData.questions.length === 0 || sessionData.currentQuestionIndex >= sessionData.questions.length) return;
    if (isGeneratingFollowUp || isRecording) return; 

    const endTime = Date.now();
    const timeTakenMs = sessionData.currentQuestionStartTime ? endTime - sessionData.currentQuestionStartTime : undefined;

    const currentQ = sessionData.questions[sessionData.currentQuestionIndex];
    const newAnswer: Answer = {
      questionId: currentQ.id,
      answerText: currentAnswer,
      timeTakenMs,
      confidenceScore: currentConfidenceScore ?? undefined,
    };

    let updatedAnswers = [...sessionData.answers, newAnswer];
    let newSessionData: InterviewSessionData | null = null;

    // Update previousConversation with the Q&A exchange
    const updatedPreviousConversation = (sessionData.previousConversation || "") + 
      `\n\nInterviewer: ${currentQ.text}\nCandidate: ${currentAnswer}`;

    if (sessionData.interviewStyle === 'case-study') {
      setIsGeneratingFollowUp(true);
      const updatedCaseConversationHistory = [...(sessionData.caseConversationHistory || []), { questionText: currentQ.text, answerText: currentAnswer }];
      const updatedCurrentCaseTurnNumber = (sessionData.currentCaseTurnNumber ?? 0) + 1;

      const isLastFollowUp = currentQ.isLikelyFinalFollowUp || updatedCurrentCaseTurnNumber > MAX_CASE_FOLLOW_UPS;

      if (isLastFollowUp) {
        newSessionData = {
          ...sessionData,
          answers: updatedAnswers,
          caseConversationHistory: updatedCaseConversationHistory,
          currentCaseTurnNumber: updatedCurrentCaseTurnNumber,
          previousConversation: updatedPreviousConversation,
          isLoading: false,
          interviewFinished: true,
          currentQuestionStartTime: undefined,
        };
        toast({ title: "Case Study Complete!", description: "Redirecting to feedback page." });
      } else {
        try {
          const initialQuestion = sessionData.questions.find(q => q.isInitialCaseQuestion);
          if (!initialQuestion || !initialQuestion.internalNotesForFollowUpGenerator) {
            throw new Error("Initial case study setup notes not found for follow-up generation.");
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
              roleType: sessionData.roleType,
              jobTitle: sessionData.jobTitle,
              jobDescription: sessionData.jobDescription,
              resume: sessionData.resume,
              targetedSkills: sessionData.targetedSkills,
              targetCompany: sessionData.targetCompany,
              interviewFocus: sessionData.interviewFocus,
              interviewerPersona: sessionData.interviewerPersona,
            },
            currentTurnNumber: updatedCurrentCaseTurnNumber,
          };

          const flowActualInput = {
            ...followUpInput,
            previousConversation: updatedPreviousConversation,
          };

          const followUpResponse: GenerateDynamicCaseFollowUpOutput = await generateDynamicCaseFollowUp(flowActualInput);

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
            previousConversation: updatedPreviousConversation,
          };

        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Failed to generate follow-up question.";
          toast({ title: "Error", description: errorMessage, variant: "destructive" });
          newSessionData = { ...sessionData, answers: updatedAnswers, previousConversation: updatedPreviousConversation, isLoading: false, error: errorMessage, currentQuestionStartTime: Date.now() };
        }
      }
      setIsGeneratingFollowUp(false);
    } else {
      if (sessionData.currentQuestionIndex === sessionData.questions.length - 1) {
        newSessionData = {
          ...sessionData,
          answers: updatedAnswers,
          previousConversation: updatedPreviousConversation,
          isLoading: false,
          interviewFinished: true,
          currentQuestionStartTime: undefined,
        };
        toast({ title: "Interview Complete!", description: "Redirecting to feedback page." });
      } else {
        newSessionData = {
          ...sessionData,
          answers: updatedAnswers,
          previousConversation: updatedPreviousConversation,
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
    setCurrentConfidenceScore(null);
  };

  const handleEndInterview = () => {
    if (!sessionData || isRecording) return;

    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop(); 
    }

    const endTime = Date.now();
    const timeTakenMs = sessionData.currentQuestionStartTime ? endTime - sessionData.currentQuestionStartTime : undefined;

    let updatedAnswers = sessionData.answers;
    let updatedCaseHistory = sessionData.caseConversationHistory;
    let updatedPreviousConversation = sessionData.previousConversation || "";

    if (sessionData.questions.length > 0 && sessionData.currentQuestionIndex < sessionData.questions.length) {
      const currentQ = sessionData.questions[sessionData.currentQuestionIndex];
      if (currentAnswer.trim() !== "" || sessionData.answers.findIndex(a => a.questionId === currentQ.id) === -1) {
         const newAnswer: Answer = {
           questionId: currentQ.id,
           answerText: currentAnswer,
           timeTakenMs,
           confidenceScore: currentConfidenceScore ?? undefined,
          };
         updatedAnswers = [...sessionData.answers.filter(a => a.questionId !== currentQ.id), newAnswer];
         
         // Update previousConversation with the final Q&A
         if (currentAnswer.trim() !== "") {
           updatedPreviousConversation += `\n\nInterviewer: ${currentQ.text}\nCandidate: ${currentAnswer}`;
         }
         
         if (sessionData.interviewStyle === 'case-study') {
           updatedCaseHistory = [...(sessionData.caseConversationHistory || []), { questionText: currentQ.text, answerText: currentAnswer }];
         }
      }
    }

    const newSessionData: InterviewSessionData = {
      ...sessionData,
      answers: updatedAnswers,
      caseConversationHistory: updatedCaseHistory,
      previousConversation: updatedPreviousConversation,
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

  const handleFetchHint = async () => {
    if (!sessionData || !sessionData.questions || sessionData.currentQuestionIndex >= sessionData.questions.length) return;

    setIsFetchingHint(true);
    setHintText(null);
    setHintError(null);

    const currentQ = sessionData.questions[sessionData.currentQuestionIndex];
    try {
      const input: GenerateHintInput = {
        questionText: currentQ.text,
        interviewType: sessionData.interviewType,
        faangLevel: sessionData.faangLevel,
        userAnswerAttempt: currentAnswer,
        interviewFocus: sessionData.interviewFocus,
        targetedSkills: sessionData.targetedSkills,
      };
      const result: GenerateHintOutput = await generateHint(input);
      setHintText(result.hintText);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to get hint.";
      setHintError(errorMsg);
      toast({ title: "Hint Error", description: errorMsg, variant: "destructive" });
    } finally {
      setIsFetchingHint(false);
    }
  };

  const openHintDialog = () => {
    setHintText(null);
    setHintError(null);
    setIsHintDialogOpen(true);
  };

  const handleFetchSampleAnswer = async () => {
    if (!sessionData || !sessionData.questions || sessionData.currentQuestionIndex >= sessionData.questions.length) return;
    
    const currentQ = sessionData.questions[sessionData.currentQuestionIndex];
    if (sessionData.sampleAnswers && sessionData.sampleAnswers[currentQ.id]) {
      setSampleAnswerText(sessionData.sampleAnswers[currentQ.id]);
      setIsSampleAnswerDialogOpen(true);
      return;
    }

    setIsFetchingSampleAnswer(true);
    setSampleAnswerText(null);
    setSampleAnswerError(null);
    setIsSampleAnswerDialogOpen(true); 

    try {
      const input: GenerateSampleAnswerInput = {
        questionText: currentQ.text,
        interviewType: sessionData.interviewType,
        faangLevel: sessionData.faangLevel,
        interviewFocus: sessionData.interviewFocus,
        targetedSkills: sessionData.targetedSkills,
        idealAnswerCharacteristics: currentQ.idealAnswerCharacteristics,
      };
      const result: GenerateSampleAnswerOutput = await generateSampleAnswer(input);
      setSampleAnswerText(result.sampleAnswerText);
      setSessionData(prev => {
        if (!prev) return null;
        const updatedSampleAnswers = { ...(prev.sampleAnswers || {}), [currentQ.id]: result.sampleAnswerText };
        const updatedSession = { ...prev, sampleAnswers: updatedSampleAnswers };
        localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(updatedSession));
        return updatedSession;
      });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to get sample answer.";
      setSampleAnswerError(errorMsg);
      toast({ title: "Sample Answer Error", description: errorMsg, variant: "destructive" });
    } finally {
      setIsFetchingSampleAnswer(false);
    }
  };

  const openClarifyQuestionDialog = () => {
    setUserClarifyingQuestionInput("");
    setClarificationForQuestion(null);
    setQuestionClarificationError(null);
    setIsClarifyQuestionDialogOpen(true);
  };

  const handleFetchQuestionClarification = async () => {
    if (!userClarifyingQuestionInput.trim() || !sessionData || !sessionData.questions || sessionData.currentQuestionIndex >= sessionData.questions.length) return;
    
    setIsFetchingQuestionClarification(true);
    setClarificationForQuestion(null);
    setQuestionClarificationError(null);

    const currentQ = sessionData.questions[sessionData.currentQuestionIndex];
    try {
      const input: ClarifyInterviewQuestionInput = {
        interviewQuestionText: currentQ.text,
        userClarificationRequest: userClarifyingQuestionInput,
        interviewContext: {
          interviewType: sessionData.interviewType,
          interviewStyle: sessionData.interviewStyle,
          faangLevel: sessionData.faangLevel,
          roleType: sessionData.roleType,
          jobTitle: sessionData.jobTitle,
          jobDescription: sessionData.jobDescription,
          resume: sessionData.resume,
          targetedSkills: sessionData.targetedSkills,
          targetCompany: sessionData.targetCompany,
          interviewFocus: sessionData.interviewFocus,
          interviewerPersona: sessionData.interviewerPersona,
          previousConversation: sessionData.previousConversation,
        },
      };
      const result: ClarifyInterviewQuestionOutput = await clarifyInterviewQuestion(input);
      setClarificationForQuestion(result.clarificationText);
      
      // Update previousConversation with the clarification exchange
      const updatedPreviousConversation = (sessionData.previousConversation || "") + 
        `\n\n[USER ASKS FOR CLARIFICATION ON: "${currentQ.text}"]\nUser's request: ${userClarifyingQuestionInput}` +
        `\n[AI CLARIFIES]: ${result.clarificationText}`;
        
      // Update session data with the new previousConversation
      const updatedSession = {
        ...sessionData,
        previousConversation: updatedPreviousConversation,
      };
      localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(updatedSession));
      setSessionData(updatedSession);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to get clarification.";
      setQuestionClarificationError(errorMsg);
      toast({ title: "Clarification Error", description: errorMsg, variant: "destructive" });
    } finally {
      setIsFetchingQuestionClarification(false);
    }
  };


  const ConfidenceRating = () => (
    <div className="mt-4">
      <label className="block text-sm font-medium text-muted-foreground mb-2">Rate your confidence in this answer (1-5 stars):</label>
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <Button
            key={rating}
            variant="ghost"
            size="icon"
            onClick={() => setCurrentConfidenceScore(rating)}
            className={`rounded-full p-1 ${currentConfidenceScore === rating ? "text-yellow-400 bg-yellow-50 hover:bg-yellow-100" : "text-gray-300 hover:text-yellow-300"}`}
            aria-label={`Rate ${rating} star`}
          >
            <Star className={`h-6 w-6 ${currentConfidenceScore !== null && rating <= currentConfidenceScore ? "fill-current" : "fill-transparent"}`} />
          </Button>
        ))}
      </div>
    </div>
  );

  if (!sessionData || (sessionData.isLoading && !sessionData.questions.length && !isGeneratingFollowUp && !sessionData.error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Preparing your interview...</p>
      </div>
    );
  }

  if (sessionData.error && !isGeneratingFollowUp) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <XCircle className="h-5 w-5" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{sessionData.error}</AlertDescription>
        <Button onClick={() => {
            localStorage.removeItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION);
            router.push("/");
          }} className="mt-4">Back to Setup</Button>
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

  
  if (!isGeneratingFollowUp && (!sessionData.questions || sessionData.questions.length === 0 || sessionData.currentQuestionIndex >= sessionData.questions.length)) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <XCircle className="h-5 w-5" />
        <AlertTitle>Interview Setup Incomplete</AlertTitle>
        <AlertDescription>
          No questions were loaded for this interview session. This might be due to an issue during question generation or an incomplete setup. Please try starting a new interview.
        </AlertDescription>
        <Button onClick={() => {
          localStorage.removeItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION); 
          router.push("/");
        }} className="mt-4">Back to Setup</Button>
      </Alert>
    );
  }


  const currentQuestion = sessionData.questions[sessionData.currentQuestionIndex];
  const styleLabel = INTERVIEW_STYLES.find(s => s.value === sessionData.interviewStyle)?.label || sessionData.interviewStyle;
  const personaLabel = INTERVIEWER_PERSONAS.find(p => p.value === sessionData.interviewerPersona)?.label || sessionData.interviewerPersona;


  const isCaseStudyStyle = sessionData.interviewStyle === 'case-study';
  const progressValue = isCaseStudyStyle
    ? (((sessionData.currentCaseTurnNumber ?? 0) + 1) / (MAX_CASE_FOLLOW_UPS + 1)) * 100
    : (sessionData.questions.length > 0 ? ((sessionData.currentQuestionIndex + 1) / sessionData.questions.length) * 100 : 0);

  const recordButtonDisabled = !isSpeechApiSupported || micPermissionStatus === 'denied' || micPermissionStatus === 'pending';

  return (
    <>
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <MessageSquare className="mr-3 h-7 w-7 text-primary" />
          Interview: {sessionData.interviewType} ({styleLabel})
        </CardTitle>
        <div className="flex flex-wrap justify-between items-center text-sm text-muted-foreground gap-x-4 gap-y-2 mt-1">
          <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
            {sessionData.jobTitle && (
              <span className="flex items-center"><Briefcase className="h-4 w-4 mr-1 text-primary/80" />{sessionData.jobTitle}</span>
            )}
            <span className="flex items-center"><Star className="h-4 w-4 mr-1 text-primary/80" />Level: {sessionData.faangLevel}</span>
             {sessionData.interviewerPersona && (
              <span className="flex items-center"><UserCheck2 className="h-4 w-4 mr-1 text-primary/80" />Persona: {personaLabel}</span>
            )}
            {isCaseStudyStyle ? (
              <span className="flex items-center"><Layers className="h-4 w-4 mr-1 text-primary/80" />Turn: {(sessionData.currentCaseTurnNumber ?? 0) + 1}</span>
            ) : (
               <span className="flex items-center">Question {sessionData.currentQuestionIndex + 1} of {sessionData.questions.length}</span>
            )}
            {sessionData.targetCompany && (
              <span className="flex items-center"><Building className="h-4 w-4 mr-1 text-primary/80" />Target: {sessionData.targetCompany}</span>
            )}
            {sessionData.interviewFocus && (
              <span className="flex items-center"><SearchCheck className="h-4 w-4 mr-1 text-primary/80" />Focus: {sessionData.interviewFocus}</span>
            )}
          </div>
          {sessionData.interviewStarted && !sessionData.interviewFinished && sessionData.currentQuestionStartTime && sessionData.interviewStyle !== 'take-home' && (
            <div className="flex items-center text-sm text-muted-foreground shrink-0">
              <TimerIcon className="h-4 w-4 mr-1" />
              {formatMilliseconds(currentTime)}
            </div>
          )}
        </div>
        <Progress value={progressValue} className="mt-3" />
      </CardHeader>
      <CardContent className="space-y-6">
        {isCaseStudyStyle && sessionData.caseConversationHistory && sessionData.caseConversationHistory.length > 0 && (
            <Accordion type="single" collapsible className="w-full mb-6 border rounded-md shadow-sm">
                <AccordionItem value="history">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline bg-secondary/30 rounded-t-md">
                        <div className="flex items-center text-sm font-medium text-muted-foreground">
                            <History className="h-4 w-4 mr-2 text-primary" />
                            View Case Study History (Previous Turns)
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 py-3 space-y-3 text-sm bg-background rounded-b-md max-h-60 overflow-y-auto">
                        {sessionData.caseConversationHistory.map((turn, index) => (
                            <div key={index} className="pb-2 mb-2 border-b last:border-b-0 last:pb-0 last:mb-0">
                                <p className="font-semibold text-primary">Interviewer (Turn {index + 1}):</p>
                                <p className="ml-2 whitespace-pre-wrap text-foreground/90">{turn.questionText}</p>
                                <p className="font-semibold text-accent mt-1.5">Your Answer:</p>
                                <p className="ml-2 whitespace-pre-wrap text-foreground/90">{turn.answerText}</p>
                            </div>
                        ))}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        )}

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
               isCaseStudyStyle ? `Follow-up Question (Turn ${(sessionData.currentCaseTurnNumber ?? 0) + 1}):` :
               `Question ${sessionData.currentQuestionIndex + 1}:`}
            </h2>
             <p className={`text-lg mb-3 ${sessionData.interviewStyle === 'take-home' ? 'whitespace-pre-wrap p-4 border rounded-md bg-secondary/30' : ''}`}>
                {currentQuestion.text}
            </p>
            <div className="mb-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs text-muted-foreground hover:text-primary hover:bg-secondary/50">
                            <HelpCircle className="mr-1.5 h-3.5 w-3.5" /> Help Tools
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={openClarifyQuestionDialog}>
                            <MessageCircleQuestion className="mr-2 h-4 w-4" /> Clarify This Question
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={openExplainTermDialog}>
                            <Lightbulb className="mr-2 h-4 w-4" /> Explain a concept
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={openHintDialog}>
                            <Sparkles className="mr-2 h-4 w-4" /> Get a hint
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleFetchSampleAnswer}>
                            <BookOpen className="mr-2 h-4 w-4" /> View Sample Answer
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {sessionData.interviewStyle === 'case-study' && (
              <div className="mt-4 mb-6">
                <label htmlFor="caseStudyNotes" className="block text-sm font-medium text-muted-foreground mb-1 flex items-center">
                  <StickyNote className="h-4 w-4 mr-2 text-primary" />
                  Your Notes for this Case Study:
                </label>
                <Textarea
                  id="caseStudyNotes"
                  placeholder="Jot down your thoughts, calculations, or key points here..."
                  value={sessionData.caseStudyNotes || ""}
                  onChange={(e) => {
                    setSessionData(prev => {
                      if (!prev) return null;
                      const newNotes = e.target.value;
                      const updatedSession = { ...prev, caseStudyNotes: newNotes };
                      localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(updatedSession));
                      return updatedSession;
                    });
                  }}
                  className="min-h-[150px] text-sm bg-secondary/20 border-input"
                  rows={6}
                />
              </div>
            )}
            
            <div className="relative">
                <Textarea
                  placeholder={sessionData.interviewStyle === 'take-home' ? "Paste your full response here..." : "Type your answer here or use the microphone..."}
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  className="min-h-[200px] text-base pr-12" 
                  rows={sessionData.interviewStyle === 'take-home' ? 15 : 8}
                  disabled={isGeneratingFollowUp || isRecording}
                />
                {sessionData.interviewStyle !== 'take-home' && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleToggleRecording}
                        disabled={recordButtonDisabled}
                        className={`absolute right-2 bottom-2 text-muted-foreground hover:text-primary ${isRecording ? "text-red-500 hover:text-red-600" : ""}`}
                        aria-label={isRecording ? "Stop recording" : "Record answer"}
                    >
                        {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </Button>
                )}
            </div>
             {speechError && <Alert variant="destructive" className="mt-2 text-xs"><AlertTriangle className="h-3 w-3" /><AlertDescription>{speechError}</AlertDescription></Alert>}


            {sessionData.interviewStyle !== 'take-home' && <ConfidenceRating />}
          </div>
        ) : null }
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleEndInterview} disabled={sessionData.isLoading || isGeneratingFollowUp || isRecording}>
          End Interview
        </Button>
        <Button
          onClick={handleNextQuestion}
          disabled={sessionData.isLoading || (!currentAnswer.trim() && sessionData.interviewStyle !== 'case-study') || isGeneratingFollowUp || isRecording}
          className="bg-accent hover:bg-accent/90"
        >
          {isGeneratingFollowUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {sessionData.interviewStyle === 'case-study'
            ? (currentQuestion?.isLikelyFinalFollowUp || (sessionData.currentCaseTurnNumber ?? 0) >= MAX_CASE_FOLLOW_UPS ? "Finish Case & View Feedback" : "Submit & Get Next Follow-up")
            : (sessionData.currentQuestionIndex === sessionData.questions.length - 1 ? "Finish & View Feedback" : "Next Question")
          }
          {!isGeneratingFollowUp && !isRecording && <ArrowRight className="ml-2 h-4 w-4" />}
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

      <Dialog open={isHintDialogOpen} onOpenChange={setIsHintDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Sparkles className="mr-2 h-5 w-5 text-primary" /> Need a Hint?
            </DialogTitle>
            <DialogDescription>
              Click below to get a hint for the current question.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isFetchingHint && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating your hint...
              </div>
            )}
            {hintError && !isFetchingHint && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Hint Error</AlertTitle>
                <AlertDescription>{hintError}</AlertDescription>
              </Alert>
            )}
            {hintText && !isFetchingHint && (
              <Alert variant="default" className="bg-yellow-50 border-yellow-200">
                 <Lightbulb className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-700">Hint</AlertTitle>
                <AlertDescription className="text-yellow-700">
                  {hintText}
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
            <Button type="button" onClick={handleFetchHint} disabled={isFetchingHint || !!hintText}>
              {isFetchingHint ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {hintText ? "Hint Received" : "Show Hint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSampleAnswerDialogOpen} onOpenChange={setIsSampleAnswerDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <BookOpen className="mr-2 h-5 w-5 text-primary" /> Sample Answer
            </DialogTitle>
            {currentQuestion && <DialogDescription>For question: "{currentQuestion.text}"</DialogDescription>}
          </DialogHeader>
          <div className="py-4 space-y-6 max-h-[60vh] overflow-y-auto pr-2">
            {isFetchingSampleAnswer && (
              <div className="flex flex-col items-center justify-center py-10">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
                <p className="text-muted-foreground">Generating sample answer...</p>
              </div>
            )}
            {sampleAnswerError && !isFetchingSampleAnswer && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Sample Answer Error</AlertTitle>
                <AlertDescription>{sampleAnswerError}</AlertDescription>
              </Alert>
            )}
            {sampleAnswerText && !isFetchingSampleAnswer && (
              <Alert variant="default" className="bg-blue-50 border-blue-200">
                <BookOpen className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-700">AI Generated Sample Answer</AlertTitle>
                <AlertDescription className="text-blue-700 whitespace-pre-wrap">
                  {sampleAnswerText}
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isClarifyQuestionDialogOpen} onOpenChange={setIsClarifyQuestionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <MessageCircleQuestion className="mr-2 h-5 w-5 text-primary" /> Clarify Interview Question
            </DialogTitle>
            {currentQuestion && <DialogDescription>Original Question: "{currentQuestion.text}"</DialogDescription>}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Type your question about the AI's question..."
              value={userClarifyingQuestionInput}
              onChange={(e) => setUserClarifyingQuestionInput(e.target.value)}
              disabled={isFetchingQuestionClarification}
            />
            {isFetchingQuestionClarification && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Getting clarification...
              </div>
            )}
            {questionClarificationError && !isFetchingQuestionClarification && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{questionClarificationError}</AlertDescription>
              </Alert>
            )}
            {clarificationForQuestion && !isFetchingQuestionClarification && (
              <Alert variant="default" className="bg-sky-50 border-sky-200">
                <Lightbulb className="h-4 w-4 text-sky-600" />
                <AlertTitle className="text-sky-700">AI Clarification:</AlertTitle>
                <AlertDescription className="text-sky-700 whitespace-pre-wrap">
                  {clarificationForQuestion}
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="sm:justify-end">
             <DialogClose asChild>
              <Button type="button" variant="secondary">Close</Button>
            </DialogClose>
            <Button type="button" onClick={handleFetchQuestionClarification} disabled={isFetchingQuestionClarification || !userClarifyingQuestionInput.trim()}>
              {isFetchingQuestionClarification ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Get Clarification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

