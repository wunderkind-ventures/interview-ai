"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getFirestore, collection, addDoc, serverTimestamp, doc, setDoc, getDoc, Timestamp, updateDoc, arrayUnion } from "firebase/firestore";
import { getApps } from 'firebase/app';
import { useAuth } from "@/contexts/auth-context";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, Home, MessageSquare, Edit, Sparkles, FileText, TimerIcon, Building, Briefcase, ThumbsUp, TrendingDown, Lightbulb, MessageCircle, CheckSquare, Layers, Search, BookOpen, AlertTriangle, SearchCheck, Star, HelpCircle, Info, BookMarked, Download, MessageSquarePlus, ShieldCheck, ListChecks } from "lucide-react";
import { LOCAL_STORAGE_KEYS, INTERVIEW_STYLES, INTERVIEW_TYPES, FAANG_LEVELS, INTERVIEWER_PERSONAS } from "@/lib/constants";
import type { InterviewSessionData, FeedbackItem, DeepDiveFeedback, InterviewQuestion, AdminFeedbackItem, AdminFeedbackTargetType as AdminFeedbackTargetTypeType } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { generateInterviewFeedbackBYOK } from "@/lib/catalyst-flows-api";
import type { GenerateInterviewFeedbackInput } from "@/ai/flows/generate-interview-feedback";
import { generateDeepDiveFeedback } from "@/ai/flows/generate-deep-dive-feedback";
import type { GenerateDeepDiveFeedbackInput, GenerateDeepDiveFeedbackOutput } from "@/ai/flows/generate-deep-dive-feedback";
import { generateSampleAnswer } from "@/ai/flows/generate-sample-answer";
import type { GenerateSampleAnswerInput, GenerateSampleAnswerOutput } from "@/ai/flows/generate-sample-answer";
import { clarifyFeedback } from "@/ai/flows/clarify-feedback";
import type { ClarifyFeedbackInput, ClarifyFeedbackOutput } from "@/ai/flows/clarify-feedback";
import { formatMilliseconds } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "./ui/scroll-area";

interface ExportOptions {
  includeSetupDetails: boolean;
  includeQuestions: boolean;
  includeIdealPointers: boolean;
  includeAnswers: boolean;
  includeFeedback: boolean;
  includeSampleAnswers: boolean;
  includeDeepDives: boolean;
  includeOverallSummary: boolean;
}

interface ClarificationContext {
  questionText: string;
  userAnswerText: string;
  feedbackItemText: string;
  feedbackItemType: 'areaForImprovement' | 'specificSuggestion' | 'critique' | 'strength' | 'idealAnswerPointer' | 'reflectionPrompt';
}

type AdminFeedbackTargetType = AdminFeedbackTargetTypeType;

function InterviewSummaryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const [sessionData, setSessionData] = useState<InterviewSessionData | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [activeDeepDiveQuestionId, setActiveDeepDiveQuestionId] = useState<string | null>(null);
  const [deepDiveContent, setDeepDiveContent] = useState<DeepDiveFeedback | null>(null);
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);

  const [activeSampleAnswerQuestionId, setActiveSampleAnswerQuestionId] = useState<string | null>(null);
  const [sampleAnswerContent, setSampleAnswerContent] = useState<string | null>(null);
  const [isSampleAnswerLoading, setIsSampleAnswerLoading] = useState(false);
  const [sampleAnswerError, setSampleAnswerError] = useState<string | null>(null);

  const [isClarifyFeedbackDialogOpen, setIsClarifyFeedbackDialogOpen] = useState(false);
  const [clarificationContext, setClarificationContext] = useState<ClarificationContext | null>(null);
  const [userClarificationRequestInput, setUserClarificationRequestInput] = useState("");
  const [clarificationResponse, setClarificationResponse] = useState<string | null>(null);
  const [isFetchingClarification, setIsFetchingClarification] = useState(false);
  const [clarificationError, setClarificationError] = useState<string | null>(null);


  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeSetupDetails: true,
    includeQuestions: true,
    includeIdealPointers: true,
    includeAnswers: true,
    includeFeedback: true,
    includeSampleAnswers: true,
    includeDeepDives: true,
    includeOverallSummary: true,
  });

  const [adminFeedbackText, setAdminFeedbackText] = useState("");
  const [adminFeedbackTargetType, setAdminFeedbackTargetType] = useState<AdminFeedbackTargetType>('overall_session');
  const [adminFeedbackTargetQuestionId, setAdminFeedbackTargetQuestionId] = useState<string>("");
  const [isSubmittingAdminFeedback, setIsSubmittingAdminFeedback] = useState(false);

  const isAdmin = authUser?.email === 'admin@example.com';

  const saveInterviewToBackend = useCallback(async (dataToLog: InterviewSessionData, docId?: string) => {
    if (getApps().length === 0) {
      console.warn("Firebase app not initialized. Skipping backend logging.");
      setSessionData(prev => {
        if (!prev) return null;
        const updatedSession = { ...prev, isLoggedToServer: true, firestoreDocId: docId || prev.firestoreDocId };
        localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(updatedSession));
        return updatedSession;
      });
      return;
    }

    if (!authUser) {
      console.log("User not logged in. Skipping backend save of interview session.");
      setSessionData(prev => {
        if (!prev) return null;
        const updatedSession = { ...prev, isLoggedToServer: true, firestoreDocId: docId || prev.firestoreDocId };
        localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(updatedSession));
        return updatedSession;
      });
      return;
    }

    const documentId = docId || dataToLog.firestoreDocId || doc(collection(getFirestore(), "users", authUser.uid, "interviews")).id;
    const db = getFirestore();

    const payloadToSave: Partial<InterviewSessionData> = {
        userId: authUser.uid,
        completedAt: dataToLog.completedAt instanceof Timestamp ? dataToLog.completedAt : serverTimestamp(),
        interviewType: dataToLog.interviewType,
        interviewStyle: dataToLog.interviewStyle,
        faangLevel: dataToLog.faangLevel,
        jobTitle: dataToLog.jobTitle ?? null,
        jobDescription: dataToLog.jobDescription ?? null,
        resume: dataToLog.resume ?? null,
        targetedSkills: dataToLog.targetedSkills ?? [],
        targetCompany: dataToLog.targetCompany ?? null,
        interviewFocus: dataToLog.interviewFocus ?? null,
        selectedThemeId: dataToLog.selectedThemeId ?? "custom",
        interviewerPersona: dataToLog.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
        currentQuestionIndex: dataToLog.currentQuestionIndex,
        interviewStarted: dataToLog.interviewStarted,
        interviewFinished: dataToLog.interviewFinished,
        currentQuestionStartTime: dataToLog.currentQuestionStartTime === undefined ? null : dataToLog.currentQuestionStartTime,
        currentCaseTurnNumber: dataToLog.currentCaseTurnNumber === undefined ? null : dataToLog.currentCaseTurnNumber,
        caseStudyNotes: dataToLog.caseStudyNotes ?? null,
        questions: (dataToLog.questions || []).map(q => ({
            id: q.id,
            text: q.text,
            ...(q.idealAnswerCharacteristics && q.idealAnswerCharacteristics.length > 0 && { idealAnswerCharacteristics: q.idealAnswerCharacteristics }),
            ...(q.isInitialCaseQuestion !== undefined && { isInitialCaseQuestion: q.isInitialCaseQuestion }),
            ...(q.fullScenarioDescription && { fullScenarioDescription: q.fullScenarioDescription }),
            ...(q.internalNotesForFollowUpGenerator && { internalNotesForFollowUpGenerator: q.internalNotesForFollowUpGenerator }),
            ...(q.isLikelyFinalFollowUp !== undefined && { isLikelyFinalFollowUp: q.isLikelyFinalFollowUp }),
        })),
        answers: (dataToLog.answers || []).map(a => ({
            questionId: a.questionId,
            answerText: a.answerText,
            ...(a.timeTakenMs !== undefined && { timeTakenMs: a.timeTakenMs }),
            ...(a.confidenceScore !== undefined && { confidenceScore: a.confidenceScore }),
        })),
        feedback: dataToLog.feedback ? {
            overallSummary: dataToLog.feedback.overallSummary,
            feedbackItems: (dataToLog.feedback.feedbackItems || []).map(item => ({
                questionId: item.questionId,
                questionText: item.questionText,
                answerText: item.answerText,
                ...(item.strengths && item.strengths.length > 0 && { strengths: item.strengths }),
                ...(item.areasForImprovement && item.areasForImprovement.length > 0 && { areasForImprovement: item.areasForImprovement }),
                ...(item.specificSuggestions && item.specificSuggestions.length > 0 && { specificSuggestions: item.specificSuggestions }),
                ...(item.critique && { critique: item.critique }),
                ...(item.idealAnswerPointers && item.idealAnswerPointers.length > 0 && { idealAnswerPointers: item.idealAnswerPointers }),
                ...(item.timeTakenMs !== undefined && { timeTakenMs: item.timeTakenMs }),
                ...(item.confidenceScore !== undefined && { confidenceScore: item.confidenceScore }),
                ...(item.reflectionPrompts && item.reflectionPrompts.length > 0 && { reflectionPrompts: item.reflectionPrompts }),
            })),
        } : null,
        deepDives: dataToLog.deepDives ? { ...dataToLog.deepDives } : {},
        sampleAnswers: dataToLog.sampleAnswers ? { ...dataToLog.sampleAnswers } : {},
        adminFeedback: (dataToLog.adminFeedback || []).map(fb => ({
          adminId: fb.adminId,
          adminEmail: fb.adminEmail ?? undefined,
          feedbackText: fb.feedbackText,
          targetType: fb.targetType,
          targetQuestionId: fb.targetQuestionId ?? undefined,
          createdAt: fb.createdAt instanceof Timestamp ? fb.createdAt : Timestamp.now(),
        })),
        caseConversationHistory: dataToLog.caseConversationHistory && dataToLog.caseConversationHistory.length > 0 ? dataToLog.caseConversationHistory : [],
        previousConversation: dataToLog.previousConversation ?? null,
    };

    Object.keys(payloadToSave).forEach(key => {
        if (payloadToSave[key as keyof InterviewSessionData] === undefined) {
            delete payloadToSave[key as keyof InterviewSessionData];
        }
    });

    try {
      await setDoc(doc(db, "users", authUser.uid, "interviews", documentId), payloadToSave, { merge: true });
      console.log("Interview session logged/updated successfully:", documentId);
      setTimeout(() => {
        toast({
          title: "Session Logged",
          description: "Your interview data has been saved to your account.",
          variant: "default",
        });
      }, 0);

      setSessionData(prev => {
        if (!prev) return null;
        const updatedSession = { ...prev, isLoggedToServer: true, firestoreDocId: documentId };
        localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(updatedSession));
        return updatedSession;
      });
    } catch (error: any) {
      console.error("Error logging interview session to backend:", error, "Payload attempted:", payloadToSave);
      setTimeout(() => {
        toast({
          title: "Logging Error",
          description: `Could not save interview data: ${error.message || "Unknown error. Check console."}`,
          variant: "destructive",
        });
      }, 0);
       setSessionData(prev => {
        if (!prev) return null;
        // Still mark as logged to prevent loops, even if it failed.
        // The error toast will inform the user.
        const updatedSession = { ...prev, isLoggedToServer: true, firestoreDocId: docId || prev.firestoreDocId };
        localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(updatedSession));
        return updatedSession;
      });
    }
  }, [toast, authUser]);


  const fetchAndSetFeedback = useCallback(async (currentSession: InterviewSessionData) => {
    if (!currentSession.interviewFinished || currentSession.feedback || isFeedbackLoading) {
      return;
    }

    setIsFeedbackLoading(true);
    setFeedbackError(null);

    try {
      const questionsForFeedback = currentSession.questions.map(q => ({
        id: q.id,
        text: q.text,
        idealAnswerCharacteristics: q.idealAnswerCharacteristics
      }));
      const answersForFeedback = currentSession.answers.map(a => ({
        questionId: a.questionId,
        answerText: a.answerText,
        timeTakenMs: a.timeTakenMs,
        confidenceScore: a.confidenceScore,
      }));

      const feedbackInput: GenerateInterviewFeedbackInput = {
        questions: questionsForFeedback,
        answers: answersForFeedback,
        interviewType: currentSession.interviewType,
        interviewStyle: currentSession.interviewStyle,
        faangLevel: currentSession.faangLevel,
        roleType: currentSession.roleType,
        targetedSkills: currentSession.targetedSkills ?? [],
        jobTitle: currentSession.jobTitle === null || currentSession.jobTitle === undefined ? undefined : currentSession.jobTitle,
        jobDescription: currentSession.jobDescription === null || currentSession.jobDescription === undefined ? undefined : currentSession.jobDescription,
        resume: currentSession.resume === null || currentSession.resume === undefined ? undefined : currentSession.resume,
        interviewFocus: currentSession.interviewFocus === null || currentSession.interviewFocus === undefined ? undefined : currentSession.interviewFocus,
      };

      const feedbackResult = await generateInterviewFeedbackBYOK(feedbackInput);

      setSessionData(prev => {
        if (!prev) return null;
        const updatedFeedbackItemsWithConfidence = feedbackResult.feedbackItems.map(item => {
          const originalAnswer = currentSession.answers.find(ans => ans.questionId === item.questionId);
          return {
            ...item,
            confidenceScore: originalAnswer?.confidenceScore,
          };
        });

        const updatedSession = { ...prev, feedback: {...feedbackResult, feedbackItems: updatedFeedbackItemsWithConfidence } };
        localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(updatedSession));

        if (updatedSession.interviewFinished && updatedSession.feedback && !updatedSession.isLoggedToServer && !authLoading && authUser) {
            saveInterviewToBackend(updatedSession, updatedSession.firestoreDocId);
        }
        return updatedSession;
      });

    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred while generating feedback.";
      setTimeout(() => {
        toast({
          title: "Error generating feedback",
          description: errorMessage,
          variant: "destructive",
        });
      }, 0);
      setFeedbackError(errorMessage);
    } finally {
      setIsFeedbackLoading(false);
    }
  }, [toast, isFeedbackLoading, saveInterviewToBackend, authLoading, authUser]);

  useEffect(() => {
    if (authLoading) {
      setIsSessionLoading(true);
      return;
    }

    const sessionIdFromQuery = searchParams.get('sessionId');

    const loadSession = async () => {
      if (sessionIdFromQuery && authUser) {
        setIsSessionLoading(true);
        try {
          const db = getFirestore();
          const interviewDocRef = doc(db, 'users', authUser.uid, 'interviews', sessionIdFromQuery);
          const docSnap = await getDoc(interviewDocRef);

          if (docSnap.exists()) {
            const firestoreData = docSnap.data() as Omit<InterviewSessionData, 'completedAt'> & { completedAt: Timestamp, firestoreDocId?: string };
            let completedAt = firestoreData.completedAt;
            if (completedAt && typeof completedAt.toDate !== 'function' && (completedAt as any).seconds) {
                completedAt = new Timestamp((completedAt as any).seconds, (completedAt as any).nanoseconds);
            }

            const loadedSessionData: InterviewSessionData = {
                ...firestoreData,
                completedAt,
                jobTitle: firestoreData.jobTitle || "",
                jobDescription: firestoreData.jobDescription || "",
                resume: firestoreData.resume || "",
                targetedSkills: firestoreData.targetedSkills || [],
                targetCompany: firestoreData.targetCompany || "",
                interviewFocus: firestoreData.interviewFocus || "",
                deepDives: firestoreData.deepDives || {},
                sampleAnswers: firestoreData.sampleAnswers || {},
                caseStudyNotes: firestoreData.caseStudyNotes ?? null,
                caseConversationHistory: firestoreData.caseConversationHistory || [],
                previousConversation: firestoreData.previousConversation || "",
                adminFeedback: firestoreData.adminFeedback || [],
                isLoading: false,
                error: null,
                isLoggedToServer: true,
                firestoreDocId: docSnap.id,
                interviewerPersona: firestoreData.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
                selectedThemeId: firestoreData.selectedThemeId || "custom",
            };
            setSessionData(loadedSessionData);
            localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(loadedSessionData));

            // Do not automatically fetch feedback if it's missing when loading from history.
            // User must click "Generate Feedback" button.

          } else {
            setTimeout(() => {
              toast({ title: "Session Not Found", description: "Could not find the specified interview session. Loading last local session.", variant: "destructive"});
            }, 0);
            loadFromLocalStorage();
          }
        } catch (error: any) {
          console.error("Error fetching session from Firestore:", error);
          const errorMsg = error.code ? `Error loading session: ${error.code} - ${error.message}` : `Error loading session: ${error.message || "Unknown Firebase error."}`;
          setTimeout(() => {
            toast({ title: "Error Loading Session", description: errorMsg, variant: "destructive"});
          }, 0);
          loadFromLocalStorage();
        } finally {
          setIsSessionLoading(false);
        }
      } else {
        loadFromLocalStorage();
      }
    };

    const loadFromLocalStorage = () => {
        const storedSession = localStorage.getItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION);
        if (storedSession) {
          try {
            const parsedSession: InterviewSessionData = JSON.parse(storedSession);
            parsedSession.isLoggedToServer = parsedSession.isLoggedToServer ?? false;
            parsedSession.firestoreDocId = parsedSession.firestoreDocId ?? undefined;
            parsedSession.deepDives = parsedSession.deepDives || {};
            parsedSession.sampleAnswers = parsedSession.sampleAnswers || {};
            parsedSession.caseStudyNotes = parsedSession.caseStudyNotes ?? null;
            parsedSession.caseConversationHistory = parsedSession.caseConversationHistory || [];
            parsedSession.previousConversation = parsedSession.previousConversation || "";
            parsedSession.adminFeedback = parsedSession.adminFeedback || [];
            parsedSession.interviewerPersona = parsedSession.interviewerPersona || INTERVIEWER_PERSONAS[0].value;
            parsedSession.selectedThemeId = parsedSession.selectedThemeId || "custom";


            if (!parsedSession.interviewFinished) {
              setTimeout(() => {
                toast({ title: "Interview Not Finished", description: "Redirecting...", variant: "default"});
              }, 0);
              router.replace(parsedSession.questions?.length > 0 ? "/interview" : "/");
              return;
            }
            setSessionData(parsedSession);

            // Do not automatically fetch feedback if it's missing.
            // User must click "Generate Feedback" button.
            // However, if feedback exists AND it's not logged, try to log.
            if (parsedSession.feedback && parsedSession.interviewFinished && !parsedSession.isLoggedToServer && authUser) {
              saveInterviewToBackend(parsedSession, parsedSession.firestoreDocId);
            }
          } catch (e: any) {
            console.error("Error parsing session data:", e);
            setTimeout(() => {
              toast({ title: "Session Error", description: "Could not load session data. Please start a new interview.", variant: "destructive"});
            }, 0);
            localStorage.removeItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION);
            router.replace("/");
          }
        } else {
          setTimeout(() => {
            toast({ title: "No Interview Data", description: "Please start an interview first.", variant: "destructive"});
          }, 0);
          router.replace("/");
        }
        setIsSessionLoading(false);
    };

    loadSession();

  }, [router, toast, saveInterviewToBackend, authLoading, authUser, searchParams]);

  const handleOpenDeepDive = async (questionId: string) => {
    if (!sessionData) return;
    setActiveDeepDiveQuestionId(questionId);
    setDeepDiveContent(null);
    setDeepDiveError(null);

    if (sessionData.deepDives && sessionData.deepDives[questionId]) {
      setDeepDiveContent(sessionData.deepDives[questionId]);
      return;
    }

    setIsDeepDiveLoading(true);
    const question = sessionData.questions.find(q => q.id === questionId);
    const answer = sessionData.answers.find(a => a.questionId === questionId);
    const originalFeedbackItem = sessionData.feedback?.feedbackItems.find(f => f.questionId === questionId);

    if (!question || !answer) {
      setDeepDiveError("Question or answer not found for deep dive.");
      setIsDeepDiveLoading(false);
      return;
    }

    try {
      const deepDiveInput: GenerateDeepDiveFeedbackInput = {
        questionText: question.text,
        userAnswerText: answer.answerText,
        interviewType: sessionData.interviewType,
        faangLevel: sessionData.faangLevel,
        jobTitle: sessionData.jobTitle,
        jobDescription: sessionData.jobDescription,
        targetedSkills: sessionData.targetedSkills,
        interviewFocus: sessionData.interviewFocus,
        originalFeedback: originalFeedbackItem,
        idealAnswerCharacteristics: question.idealAnswerCharacteristics,
      };
      const result = await generateDeepDiveFeedback(deepDiveInput);
      setDeepDiveContent(result);
      setSessionData(prev => {
        if (!prev) return null;
        const updatedDeepDives = { ...(prev.deepDives || {}), [questionId]: result };
        const updatedSession = { ...prev, deepDives: updatedDeepDives };
        localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(updatedSession));
        if (prev.isLoggedToServer && prev.firestoreDocId && authUser) {
          const db = getFirestore();
          updateDoc(doc(db, "users", authUser.uid, "interviews", prev.firestoreDocId), { deepDives: updatedDeepDives });
        }
        return updatedSession;
      });
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate deep dive feedback.";
      setDeepDiveError(errorMessage);
      setTimeout(() => {
        toast({ title: "Deep Dive Error", description: errorMessage, variant: "destructive" });
      },0);
    } finally {
      setIsDeepDiveLoading(false);
    }
  };

  const handleOpenSampleAnswer = async (questionId: string) => {
    if (!sessionData) return;
    const question = sessionData.questions.find(q => q.id === questionId);
    if (!question) {
        setTimeout(() => {
            toast({ title: "Error", description: "Question not found.", variant: "destructive" });
        }, 0);
        return;
    }

    setActiveSampleAnswerQuestionId(questionId);
    setSampleAnswerContent(null);
    setSampleAnswerError(null);

    if (sessionData.sampleAnswers && sessionData.sampleAnswers[questionId]) {
      setSampleAnswerContent(sessionData.sampleAnswers[questionId]);
      return;
    }

    setIsSampleAnswerLoading(true);
    try {
      const input: GenerateSampleAnswerInput = {
        questionText: question.text,
        interviewType: sessionData.interviewType,
        faangLevel: sessionData.faangLevel,
        interviewFocus: sessionData.interviewFocus,
        targetedSkills: sessionData.targetedSkills,
        idealAnswerCharacteristics: question.idealAnswerCharacteristics,
      };
      const result: GenerateSampleAnswerOutput = await generateSampleAnswer(input);
      setSampleAnswerContent(result.sampleAnswerText);
      setSessionData(prev => {
        if (!prev) return null;
        const updatedSampleAnswers = { ...(prev.sampleAnswers || {}), [questionId]: result.sampleAnswerText };
        const updatedSession = { ...prev, sampleAnswers: updatedSampleAnswers };
        localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(updatedSession));
        if (prev.isLoggedToServer && prev.firestoreDocId && authUser) {
          const db = getFirestore();
          updateDoc(doc(db, "users", authUser.uid, "interviews", prev.firestoreDocId), { sampleAnswers: updatedSampleAnswers });
        }
        return updatedSession;
      });
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate sample answer.";
      setSampleAnswerError(errorMessage);
      setTimeout(() => {
        toast({ title: "Sample Answer Error", description: errorMessage, variant: "destructive" });
      }, 0);
    } finally {
      setIsSampleAnswerLoading(false);
    }
  };

  const handleOpenClarifyFeedbackDialog = (
    question: InterviewQuestion,
    answerText: string,
    feedbackItemText: string,
    feedbackItemType: ClarificationContext['feedbackItemType']
  ) => {
    setClarificationContext({
      questionText: question.text,
      userAnswerText: answerText,
      feedbackItemText,
      feedbackItemType,
    });
    setUserClarificationRequestInput("");
    setClarificationResponse(null);
    setClarificationError(null);
    setIsClarifyFeedbackDialogOpen(true);
  };

  const handleFetchClarification = async () => {
    if (!clarificationContext || !userClarificationRequestInput.trim() || !sessionData) return;
    setIsFetchingClarification(true);
    setClarificationResponse(null);
    setClarificationError(null);

    try {
      const input: ClarifyFeedbackInput = {
        originalQuestionText: clarificationContext.questionText,
        userAnswerText: clarificationContext.userAnswerText,
        feedbackItemText: clarificationContext.feedbackItemText,
        userClarificationRequest: userClarificationRequestInput,
        interviewContext: {
          interviewType: sessionData.interviewType,
          faangLevel: sessionData.faangLevel,
          jobTitle: sessionData.jobTitle,
          interviewFocus: sessionData.interviewFocus,
        },
      };
      const result: ClarifyFeedbackOutput = await clarifyFeedback(input);
      setClarificationResponse(result.clarificationText);
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : "Failed to get clarification.";
      setClarificationError(errorMsg);
      setTimeout(() => {
        toast({ title: "Clarification Error", description: errorMsg, variant: "destructive" });
      }, 0);
    } finally {
      setIsFetchingClarification(false);
    }
  };


  const handleExportOptionChange = (option: keyof ExportOptions, checked: boolean) => {
    setExportOptions(prev => ({ ...prev, [option]: checked }));
  };

  const generateExportContent = (): string => {
    if (!sessionData) return "";
    let md = "# InterviewAI Summary\n\n";

    if (exportOptions.includeSetupDetails) {
      md += "## Interview Setup\n";
      md += `- **Type**: ${getLabel(sessionData.interviewType, INTERVIEW_TYPES)}\n`;
      md += `- **Style**: ${getLabel(sessionData.interviewStyle, INTERVIEW_STYLES)}\n`;
      md += `- **Level**: ${getLabel(sessionData.faangLevel, FAANG_LEVELS)}\n`;
      if (sessionData.jobTitle) md += `- **Job Title**: ${sessionData.jobTitle}\n`;
      if (sessionData.targetCompany) md += `- **Target Company**: ${sessionData.targetCompany}\n`;
      if (sessionData.interviewFocus) md += `- **Specific Focus**: ${sessionData.interviewFocus}\n`;
      if (sessionData.targetedSkills && sessionData.targetedSkills.length > 0) md += `- **Targeted Skills**: ${sessionData.targetedSkills.join(', ')}\n`;
      md += "\n---\n\n";
    }

    sessionData.questions.forEach((question, index) => {
      md += `## ${sessionData.interviewStyle === 'take-home' ? 'Assignment' : `Question ${index + 1}`}\n`;

      if (exportOptions.includeQuestions) {
        md += `**Question/Assignment Text:**\n${question.text}\n\n`;
      }

      if (exportOptions.includeIdealPointers && question.idealAnswerCharacteristics && question.idealAnswerCharacteristics.length > 0) {
        md += "**Ideal Answer Characteristics (AI Design):**\n";
        question.idealAnswerCharacteristics.forEach(char => md += `- ${char}\n`);
        md += "\n";
      }

      const answer = sessionData.answers.find(a => a.questionId === question.id);
      if (exportOptions.includeAnswers && answer) {
        md += "**Your Answer:**\n";
        md += `> ${answer.answerText.replace(/\n/g, '\n> ')}\n`;
        let answerMeta = [];
        if (answer.confidenceScore !== undefined) answerMeta.push(`Confidence: ${answer.confidenceScore}/5`);
        if (answer.timeTakenMs !== undefined) answerMeta.push(`Time: ${formatMilliseconds(answer.timeTakenMs)}`);
        if (answerMeta.length > 0) md += `(${answerMeta.join(' | ')})\n`;
        md += "\n";
      }

      const feedback = sessionData.feedback?.feedbackItems.find(f => f.questionId === question.id);
      if (exportOptions.includeFeedback && feedback) {
        md += "**AI Feedback:**\n";
        if (feedback.critique) md += `**Critique:** ${feedback.critique}\n`;
        if (feedback.strengths && feedback.strengths.length > 0) {
          md += "**Strengths:**\n";
          feedback.strengths.forEach(s => md += `- ${s}\n`);
        }
        if (feedback.areasForImprovement && feedback.areasForImprovement.length > 0) {
          md += "**Areas for Improvement:**\n";
          feedback.areasForImprovement.forEach(a => md += `- ${a}\n`);
        }
        if (feedback.specificSuggestions && feedback.specificSuggestions.length > 0) {
          md += "**Specific Suggestions:**\n";
          feedback.specificSuggestions.forEach(s => md += `- ${s}\n`);
        }
        if (feedback.idealAnswerPointers && feedback.idealAnswerPointers.length > 0) {
          md += "**Ideal Answer Pointers (for your answer):**\n";
          feedback.idealAnswerPointers.forEach(p => md += `- ${p}\n`);
        }
        if (feedback.reflectionPrompts && feedback.reflectionPrompts.length > 0) {
          md += "**Reflection Prompts:**\n";
          feedback.reflectionPrompts.forEach(p => md += `- ${p}\n`);
        }
        md += "\n";
      }

      const sample = sessionData.sampleAnswers?.[question.id];
      if (exportOptions.includeSampleAnswers && sample) {
        md += "**Sample Answer (AI Generated):**\n";
        md += `> ${sample.replace(/\n/g, '\n> ')}\n\n`;
      }

      const deepDive = sessionData.deepDives?.[question.id];
      if (exportOptions.includeDeepDives && deepDive) {
        md += "**Deep Dive Analysis:**\n";
        if (deepDive.detailedIdealAnswerBreakdown && deepDive.detailedIdealAnswerBreakdown.length > 0) {
            md += "_Detailed Ideal Answer Breakdown:_\n";
            deepDive.detailedIdealAnswerBreakdown.forEach(b => md += `  - ${b}\n`);
        }
        if (deepDive.alternativeApproaches && deepDive.alternativeApproaches.length > 0) {
            md += "_Alternative Approaches:_\n";
            deepDive.alternativeApproaches.forEach(a => md += `  - ${a}\n`);
        }
        if (deepDive.followUpScenarios && deepDive.followUpScenarios.length > 0) {
            md += "_Follow-up Scenarios:_\n";
            deepDive.followUpScenarios.forEach(s => md += `  - ${s}\n`);
        }
        if (deepDive.suggestedStudyConcepts && deepDive.suggestedStudyConcepts.length > 0) {
            md += "_Suggested Study Concepts:_\n";
            deepDive.suggestedStudyConcepts.forEach(c => md += `  - ${c}\n`);
        }
        md += "\n";
      }
      md += "---\n\n";
    });

    if (exportOptions.includeOverallSummary && sessionData.feedback?.overallSummary) {
      md += "## Overall Summary & Advice\n";
      md += `${sessionData.feedback.overallSummary}\n`;
    }
    return md;
  };

  const handleDownloadExport = () => {
    const markdownContent = generateExportContent();
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStamp = new Date().toISOString().split('T')[0];
    link.download = `InterviewAI-Summary-${dateStamp}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportDialogOpen(false);
    setTimeout(() => {
      toast({ title: "Export Successful", description: "Your interview summary has been downloaded." });
    }, 0);
  };

  const handleAdminFeedbackSubmit = async () => {
    if (!adminFeedbackText.trim() || !sessionData || !sessionData.firestoreDocId || !authUser) {
        setTimeout(() => {
            toast({ title: "Error", description: "Missing data to submit admin feedback.", variant: "destructive"});
        }, 0);
        return;
    }
    setIsSubmittingAdminFeedback(true);
    try {
        const db = getFirestore();
        const newFeedback: AdminFeedbackItem = {
            adminId: authUser.uid,
            adminEmail: authUser.email === null ? undefined : authUser.email,
            feedbackText: adminFeedbackText,
            targetType: adminFeedbackTargetType,
            targetQuestionId: (adminFeedbackTargetType !== 'overall_session' && adminFeedbackTargetQuestionId) ? adminFeedbackTargetQuestionId : undefined,
            createdAt: Timestamp.now(),
        };

        const interviewDocRef = doc(db, "users", authUser.uid, "interviews", sessionData.firestoreDocId);
        await updateDoc(interviewDocRef, {
            adminFeedback: arrayUnion(newFeedback)
        });

        setSessionData(prev => {
            if (!prev) return null;
            const updatedAdminFeedback = [...(prev.adminFeedback || []), newFeedback];
            const updatedSession = { ...prev, adminFeedback: updatedAdminFeedback };
            localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION, JSON.stringify(updatedSession));
            return updatedSession;
        });

        setAdminFeedbackText("");
        setAdminFeedbackTargetType('overall_session');
        setAdminFeedbackTargetQuestionId("");
        setTimeout(() => {
            toast({ title: "Admin Feedback Submitted", description: "Your feedback has been recorded."});
        }, 0);
    } catch (error: any) {
        console.error("Error submitting admin feedback:", error);
        setTimeout(() => {
            toast({ title: "Admin Feedback Error", description: `Could not submit feedback: ${error.message || 'Unknown error'}. See console.`, variant: "destructive"});
        }, 0);
    } finally {
        setIsSubmittingAdminFeedback(false);
    }
  };


  if (isSessionLoading || authLoading) {
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

  const getAnswerInfoForQuestion = (questionId: string): { answerText: string; timeTakenMs?: number; confidenceScore?: number } => {
    const answerObj = sessionData.answers.find(ans => ans.questionId === questionId);
    return {
      answerText: answerObj ? answerObj.answerText : "No answer provided.",
      timeTakenMs: answerObj?.timeTakenMs,
      confidenceScore: answerObj?.confidenceScore,
    };
  };

  const getFeedbackItemForQuestion = (questionId: string): FeedbackItem | undefined => {
    if (sessionData.feedback && Array.isArray(sessionData.feedback.feedbackItems)) {
      return sessionData.feedback.feedbackItems.find(item => item.questionId === questionId);
    }
    return undefined;
  };


  const getLabel = (value: string | undefined, options: readonly { value: string; label: string }[]) => {
    if (!value) return "N/A";
    return options.find(opt => opt.value === value)?.label || value;
  };

  const isTakeHomeStyle = sessionData.interviewStyle === 'take-home';

  const renderFeedbackListWithClarification = (
    title: string,
    items: string[] | undefined,
    icon: React.ReactNode,
    itemType: ClarificationContext['feedbackItemType'],
    question: InterviewQuestion,
    answerText: string
  ) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mt-3">
        <h5 className="font-semibold text-muted-foreground mb-2 flex items-center">
          {icon}
          {title}:
        </h5>
        <ul className="list-none space-y-1.5 pl-0">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start justify-between p-2 rounded-md bg-secondary/50 hover:bg-secondary/70 transition-colors text-sm">
              <span className="flex-grow whitespace-normal break-words text-foreground/90">
                {item}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-auto shrink-0 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                onClick={() => handleOpenClarifyFeedbackDialog(question, answerText, item, itemType)}
                title="Ask for clarification on this point"
              >
                <MessageSquarePlus className="h-3.5 w-3.5 mr-1" /> Clarify
              </Button>
            </li>
          ))}
        </ul>
      </div>
    );
  };


  const renderConfidenceStars = (score: number | undefined) => {
    if (score === undefined) return <span className="text-xs text-muted-foreground italic">Not rated</span>;
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= score ? "fill-yellow-400 text-yellow-400" : "fill-gray-300 text-gray-300"}`}
          />
        ))}
        <span className="ml-1.5 text-xs text-muted-foreground">({score}/5)</span>
      </div>
    );
  };

  const currentDeepDiveQuestionText = activeDeepDiveQuestionId ? sessionData.questions.find(q => q.id === activeDeepDiveQuestionId)?.text : "";
  const currentDeepDiveUserAnswerText = activeDeepDiveQuestionId ? getAnswerInfoForQuestion(activeDeepDiveQuestionId).answerText : "";
  const currentSampleAnswerQuestionText = activeSampleAnswerQuestionId ? sessionData.questions.find(q => q.id === activeSampleAnswerQuestionId)?.text : "";


  return (
    <>
      <Card className="w-full max-w-3xl mx-auto shadow-xl">
        <CardHeader className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-3xl font-bold text-primary">Interview Completed!</CardTitle>
          <CardDescription className="text-muted-foreground pt-1 space-y-0.5">
            <div>Summary for your {getLabel(sessionData.interviewType, INTERVIEW_TYPES)} ({getLabel(sessionData.interviewStyle, INTERVIEW_STYLES)}) interview. Level: {getLabel(sessionData.faangLevel, FAANG_LEVELS)}.</div>
            {sessionData.jobTitle && (
              <div className="flex items-center justify-center">
                <Briefcase className="h-4 w-4 mr-1.5 text-primary" /> Role: {sessionData.jobTitle}
              </div>
            )}
            {sessionData.targetCompany && (
              <div className="flex items-center justify-center">
                <Building className="h-4 w-4 mr-1.5 text-primary" />
                Target Company: {sessionData.targetCompany}
              </div>
            )}
            {sessionData.interviewFocus && (
              <div className="flex items-center justify-center">
                <SearchCheck className="h-4 w-4 mr-1.5 text-primary" />
                Specific Focus: {sessionData.interviewFocus}
              </div>
            )}
            {sessionData.targetedSkills && sessionData.targetedSkills.length > 0 && (
              <div className="flex items-center justify-center text-xs">
                <CheckSquare className="h-3.5 w-3.5 mr-1.5 text-primary" />
                Targeted Skills: {sessionData.targetedSkills.join(', ')}
              </div>
            )}
          </CardDescription>
            <div className="pt-4">
                <Button onClick={() => setIsExportDialogOpen(true)} variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export Interview Summary
                </Button>
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {sessionData.interviewFinished && !sessionData.feedback && !isFeedbackLoading && !feedbackError && (
            <div className="text-center py-4">
              <Button onClick={() => fetchAndSetFeedback(sessionData)} size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Sparkles className="mr-2 h-5 w-5" />
                Generate My Feedback
              </Button>
            </div>
          )}

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
            <>
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
                                      {question.idealAnswerCharacteristics && question.idealAnswerCharacteristics.length > 0 && (
                                        <Alert variant="default" className="mt-2 bg-blue-50 border-blue-200">
                                          <Info className="h-4 w-4 text-blue-600" />
                                          <AlertTitle className="text-xs font-semibold text-blue-700">AI's Ideal Answer Characteristics (for Assignment Design):</AlertTitle>
                                          <AlertDescription>
                                            <ul className="list-disc list-inside pl-1 space-y-0.5">
                                              {question.idealAnswerCharacteristics.map((char, idx) => (
                                                <li key={idx} className="text-xs text-blue-600">{char}</li>
                                              ))}
                                            </ul>
                                          </AlertDescription>
                                        </Alert>
                                      )}
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
                                            <div className="mb-3 p-2 rounded-md hover:bg-accent/10 transition-colors">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h5 className="font-semibold text-muted-foreground mb-1 flex items-center">
                                                        <MessageCircle className="h-4 w-4 mr-2 text-primary" /> Overall Critique:
                                                        </h5>
                                                        <p className="text-sm">{feedbackItem.critique}</p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="ml-2 h-auto shrink-0 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                                                        onClick={() => handleOpenClarifyFeedbackDialog(question, answerInfo.answerText, feedbackItem.critique!, 'critique')}
                                                        title="Ask for clarification on this critique"
                                                    >
                                                        <MessageSquarePlus className="h-3.5 w-3.5 mr-1" /> Clarify
                                                    </Button>
                                                </div>
                                            </div>
                                          )}
                                          {renderFeedbackListWithClarification("Strengths", feedbackItem.strengths, <ThumbsUp className="h-4 w-4 mr-2 text-green-500" />, 'strength', question, answerInfo.answerText)}
                                          {renderFeedbackListWithClarification("Areas for Improvement", feedbackItem.areasForImprovement, <TrendingDown className="h-4 w-4 mr-2 text-orange-500" />, 'areaForImprovement', question, answerInfo.answerText)}
                                          {renderFeedbackListWithClarification("Specific Suggestions", feedbackItem.specificSuggestions, <Lightbulb className="h-4 w-4 mr-2 text-blue-500" />, 'specificSuggestion', question, answerInfo.answerText)}
                                          {renderFeedbackListWithClarification("Ideal Submission Pointers", feedbackItem.idealAnswerPointers, <CheckSquare className="h-4 w-4 mr-2 text-purple-500" />, 'idealAnswerPointer', question, answerInfo.answerText)}
                                          {renderFeedbackListWithClarification("Points to Reflect On", feedbackItem.reflectionPrompts, <HelpCircle className="h-4 w-4 mr-2 text-teal-500" />, 'reflectionPrompt', question, answerInfo.answerText)}
                                          <div className="flex space-x-2 mt-4">
                                              <Button
                                                  onClick={() => handleOpenDeepDive(question.id)}
                                                  variant="outline"
                                                  size="sm"
                                                  className="bg-accent/10 hover:bg-accent/20 border-accent/30 text-accent"
                                                  disabled={!feedbackItem}
                                              >
                                                  <Layers className="mr-2 h-4 w-4" /> Deep Dive
                                              </Button>
                                              <Button
                                                  onClick={() => handleOpenSampleAnswer(question.id)}
                                                  variant="outline"
                                                  size="sm"
                                                  className="bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-600"
                                              >
                                                  <BookMarked className="mr-2 h-4 w-4" /> View Sample Answer
                                              </Button>
                                          </div>
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
                                  {question.idealAnswerCharacteristics && question.idealAnswerCharacteristics.length > 0 && (
                                    <Alert variant="default" className="mb-2 bg-blue-50 border-blue-200">
                                      <Info className="h-4 w-4 text-blue-600" />
                                      <AlertTitle className="text-xs font-semibold text-blue-700">AI's Ideal Answer Characteristics (for Question Design):</AlertTitle>
                                      <AlertDescription>
                                        <ul className="list-disc list-inside pl-1 space-y-0.5">
                                          {question.idealAnswerCharacteristics.map((char, idx) => (
                                            <li key={idx} className="text-xs text-blue-600">{char}</li>
                                          ))}
                                        </ul>
                                      </AlertDescription>
                                    </Alert>
                                  )}
                                  <div>
                                      <div className="flex justify-between items-center mb-1">
                                          <p className="font-semibold text-muted-foreground">Your Answer:</p>
                                          <div className="flex items-center space-x-3">
                                            {answerInfo.confidenceScore !== undefined && (
                                              <div className="flex items-center text-xs text-muted-foreground">
                                                <span className="mr-1">Confidence:</span> {renderConfidenceStars(answerInfo.confidenceScore)}
                                              </div>
                                            )}
                                            {answerInfo.timeTakenMs !== undefined && (
                                                <p className="text-xs text-muted-foreground flex items-center">
                                                    <TimerIcon className="h-3 w-3 mr-1" /> {displayTime}
                                                </p>
                                            )}
                                          </div>
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
                                            <div className="mb-3 p-2 rounded-md hover:bg-accent/10 transition-colors">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h5 className="font-semibold text-muted-foreground mb-1 flex items-center">
                                                        <MessageCircle className="h-4 w-4 mr-2 text-primary" /> Overall Critique:
                                                        </h5>
                                                        <p className="text-sm">{feedbackItem.critique}</p>
                                                    </div>
                                                     <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="ml-2 h-auto shrink-0 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                                                        onClick={() => handleOpenClarifyFeedbackDialog(question, answerInfo.answerText, feedbackItem.critique!, 'critique')}
                                                        title="Ask for clarification on this critique"
                                                    >
                                                        <MessageSquarePlus className="h-3.5 w-3.5 mr-1" /> Clarify
                                                    </Button>
                                                </div>
                                            </div>
                                          )}
                                          {renderFeedbackListWithClarification("Strengths", feedbackItem.strengths, <ThumbsUp className="h-4 w-4 mr-2 text-green-500" />, 'strength', question, answerInfo.answerText)}
                                          {renderFeedbackListWithClarification("Areas for Improvement", feedbackItem.areasForImprovement, <TrendingDown className="h-4 w-4 mr-2 text-orange-500" />, 'areaForImprovement', question, answerInfo.answerText)}
                                          {renderFeedbackListWithClarification("Specific Suggestions", feedbackItem.specificSuggestions, <Lightbulb className="h-4 w-4 mr-2 text-blue-500" />, 'specificSuggestion', question, answerInfo.answerText)}
                                          {renderFeedbackListWithClarification("Ideal Answer Pointers", feedbackItem.idealAnswerPointers, <CheckSquare className="h-4 w-4 mr-2 text-purple-500" />, 'idealAnswerPointer', question, answerInfo.answerText)}
                                          {renderFeedbackListWithClarification("Points to Reflect On", feedbackItem.reflectionPrompts, <HelpCircle className="h-4 w-4 mr-2 text-teal-500" />, 'reflectionPrompt', question, answerInfo.answerText)}
                                          <div className="flex space-x-2 mt-4">
                                              <Button
                                                  onClick={() => handleOpenDeepDive(question.id)}
                                                  variant="outline"
                                                  size="sm"
                                                  className="bg-accent/10 hover:bg-accent/20 border-accent/30 text-accent"
                                                  disabled={!feedbackItem}
                                              >
                                                  <Layers className="mr-2 h-4 w-4" /> Deep Dive
                                              </Button>
                                              <Button
                                                  onClick={() => handleOpenSampleAnswer(question.id)}
                                                  variant="outline"
                                                  size="sm"
                                                  className="bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-600"
                                              >
                                                  <BookMarked className="mr-2 h-4 w-4" /> View Sample Answer
                                              </Button>
                                          </div>
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
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center text-foreground">
                  <Sparkles className="mr-2 h-6 w-6 text-accent" />
                  Overall Summary & Advice
                </h3>
                <div className="whitespace-pre-wrap bg-accent/10 p-4 rounded-md border border-accent/30 text-base">
                  {sessionData.feedback.overallSummary}
                </div>
              </div>
            </>
          )}

          {sessionData.answers.length === 0 && !isFeedbackLoading && (
              <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No Answers Recorded</AlertTitle>
                  <AlertDescription>
                    It looks like no answers were submitted for this session, so feedback cannot be generated.
                  </AlertDescription>
              </Alert>
          )}

          {isAdmin && sessionData && sessionData.firestoreDocId && (
            <Card className="mt-8 border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg text-primary flex items-center">
                  <ShieldCheck className="mr-2 h-5 w-5" /> Admin Feedback
                </CardTitle>
                <CardDescription>Provide feedback on this interview session to help improve the AI.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sessionData.adminFeedback && sessionData.adminFeedback.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-muted-foreground">Existing Admin Feedback:</h4>
                    <ScrollArea className="h-40 border rounded-md p-3 bg-background">
                      {sessionData.adminFeedback.map((fb, index) => (
                        <div key={index} className="text-xs mb-2 pb-2 border-b last:border-b-0 last:mb-0">
                          <p className="font-medium">{fb.adminEmail || fb.adminId} ({fb.targetType}{fb.targetQuestionId ? ` - QID: ${fb.targetQuestionId.substring(0,8)}...` : ''}):</p>
                          <p className="whitespace-pre-wrap text-foreground/80">{fb.feedbackText}</p>
                          <p className="text-muted-foreground/70 mt-0.5">{fb.createdAt.toDate().toLocaleString()}</p>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}
                <div>
                  <Label htmlFor="adminFeedbackTargetType">Feedback Target Type</Label>
                  <Select value={adminFeedbackTargetType} onValueChange={(value) => setAdminFeedbackTargetType(value as AdminFeedbackTargetType)}>
                    <SelectTrigger id="adminFeedbackTargetType">
                      <SelectValue placeholder="Select target type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="overall_session">Overall Session</SelectItem>
                      <SelectItem value="ai_question_quality">AI Question Quality</SelectItem>
                      <SelectItem value="ai_feedback_quality">AI Feedback Quality</SelectItem>
                      <SelectItem value="user_answer_quality">User Answer Quality</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {adminFeedbackTargetType !== 'overall_session' && (
                  <div>
                    <Label htmlFor="adminFeedbackTargetQuestionId">Target Question ID (if applicable)</Label>
                    <Select value={adminFeedbackTargetQuestionId} onValueChange={setAdminFeedbackTargetQuestionId}>
                        <SelectTrigger id="adminFeedbackTargetQuestionId">
                            <SelectValue placeholder="Select question to target..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">N/A (or select a question)</SelectItem>
                            {sessionData.questions.map((q, idx) => (
                                <SelectItem key={q.id} value={q.id}>
                                    Q{idx + 1}: {q.text.substring(0, 50)}...
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label htmlFor="adminFeedbackText">Your Feedback</Label>
                  <Textarea
                    id="adminFeedbackText"
                    value={adminFeedbackText}
                    onChange={(e) => setAdminFeedbackText(e.target.value)}
                    placeholder="Enter your observations or suggestions..."
                    rows={3}
                  />
                </div>
                <Button onClick={handleAdminFeedbackSubmit} disabled={isSubmittingAdminFeedback || !adminFeedbackText.trim()}>
                  {isSubmittingAdminFeedback && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Admin Feedback
                </Button>
              </CardContent>
            </Card>
          )}

        </CardContent>

        {activeDeepDiveQuestionId && (
          <Dialog open={!!activeDeepDiveQuestionId} onOpenChange={(open) => { if (!open) setActiveDeepDiveQuestionId(null); }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl text-primary flex items-center">
                  <Layers className="mr-3 h-7 w-7" /> Deep Dive Analysis
                </DialogTitle>
                <DialogDescription className="pt-2">
                  Exploring the question: <span className="font-semibold">"{currentDeepDiveQuestionText}"</span>
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                <div>
                    <h4 className="font-semibold text-muted-foreground mb-1">Your Answer:</h4>
                    <p className="whitespace-pre-wrap bg-secondary/30 p-3 rounded-md border text-sm">{currentDeepDiveUserAnswerText || "No answer provided."}</p>
                </div>

                {isDeepDiveLoading && (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
                    <p className="text-muted-foreground">Generating deep dive insights...</p>
                  </div>
                )}
                {deepDiveError && !isDeepDiveLoading && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-5 w-5" />
                    <AlertTitle>Deep Dive Error</AlertTitle>
                    <AlertDescription>
                      {deepDiveError}
                      <Button
                          onClick={() => activeDeepDiveQuestionId && handleOpenDeepDive(activeDeepDiveQuestionId)}
                          variant="link"
                          className="p-0 h-auto ml-1 text-destructive hover:text-destructive/80"
                      >
                          Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {deepDiveContent && !isDeepDiveLoading && !deepDiveError && (
                  <div className="space-y-4">
                    {renderFeedbackListWithClarification("Detailed Ideal Answer Breakdown", deepDiveContent.detailedIdealAnswerBreakdown, <ListChecks className="h-5 w-5 text-green-600" />, 'idealAnswerPointer', sessionData.questions.find(q=>q.id===activeDeepDiveQuestionId)!, currentDeepDiveUserAnswerText)}
                    {renderFeedbackListWithClarification("Alternative Approaches", deepDiveContent.alternativeApproaches, <Lightbulb className="h-5 w-5 text-blue-600" />, 'critique', sessionData.questions.find(q=>q.id===activeDeepDiveQuestionId)!, currentDeepDiveUserAnswerText)}
                    {renderFeedbackListWithClarification("Follow-up Scenarios / Probing Questions", deepDiveContent.followUpScenarios, <Search className="h-5 w-5 text-purple-600" />, 'critique', sessionData.questions.find(q=>q.id===activeDeepDiveQuestionId)!, currentDeepDiveUserAnswerText)}
                    {renderFeedbackListWithClarification("Suggested Study Concepts", deepDiveContent.suggestedStudyConcepts, <BookOpen className="h-5 w-5 text-orange-600" />, 'critique', sessionData.questions.find(q=>q.id===activeDeepDiveQuestionId)!, currentDeepDiveUserAnswerText)}
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {activeSampleAnswerQuestionId && (
          <Dialog open={!!activeSampleAnswerQuestionId} onOpenChange={(open) => { if(!open) setActiveSampleAnswerQuestionId(null); }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl text-primary flex items-center">
                  <BookMarked className="mr-3 h-7 w-7" /> Sample Answer
                </DialogTitle>
                {currentSampleAnswerQuestionText && <DialogDescription className="pt-2">For question: <span className="font-semibold">"{currentSampleAnswerQuestionText}"</span></DialogDescription>}
              </DialogHeader>
              <div className="py-4 space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                {isSampleAnswerLoading && (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
                    <p className="text-muted-foreground">Generating sample answer...</p>
                  </div>
                )}
                {sampleAnswerError && !isSampleAnswerLoading && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-5 w-5" />
                    <AlertTitle>Sample Answer Error</AlertTitle>
                    <AlertDescription>
                      {sampleAnswerError}
                      <Button
                          onClick={() => activeSampleAnswerQuestionId && handleOpenSampleAnswer(activeSampleAnswerQuestionId)}
                          variant="link"
                          className="p-0 h-auto ml-1 text-destructive hover:text-destructive/80"
                      >
                          Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {sampleAnswerContent && !isSampleAnswerLoading && !sampleAnswerError && (
                  <div className="whitespace-pre-wrap bg-blue-500/5 p-4 rounded-md border border-blue-500/20 text-sm text-foreground/90">
                      {sampleAnswerContent}
                  </div>
                )}
              </div>
              <DialogFooter>
                  <DialogClose asChild>
                      <Button variant="outline">Close</Button>
                  </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Download className="mr-2 h-5 w-5 text-primary" /> Export Interview Summary
              </DialogTitle>
              <DialogDescription>
                Select the sections you want to include in your Markdown export.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3">
              {Object.keys(exportOptions).map((key) => {
                const optionKey = key as keyof ExportOptions;
                const label = optionKey
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, (str) => str.toUpperCase());

                return (
                  <div key={optionKey} className="flex items-center space-x-2">
                    <Checkbox
                      id={optionKey}
                      checked={exportOptions[optionKey]}
                      onCheckedChange={(checked) => handleExportOptionChange(optionKey, !!checked)}
                    />
                    <Label htmlFor={optionKey} className="text-sm font-normal">
                      {label}
                    </Label>
                  </div>
                );
              })}
            </div>
            <DialogFooter className="sm:justify-between">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="button" onClick={handleDownloadExport}>
                <Download className="mr-2 h-4 w-4" />
                Download Export
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isClarifyFeedbackDialogOpen} onOpenChange={setIsClarifyFeedbackDialogOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center">
                        <MessageSquarePlus className="mr-2 h-5 w-5 text-primary" /> Ask for Clarification
                    </DialogTitle>
                    {clarificationContext && (
                        <DialogDescription className="text-xs text-muted-foreground pt-1">
                            Original Question: "{clarificationContext.questionText.substring(0, 70)}..."<br/>
                            Your Answer Snippet: "{clarificationContext.userAnswerText.substring(0, 70)}..."<br/>
                            Feedback you're asking about: "{clarificationContext.feedbackItemText}"
                        </DialogDescription>
                    )}
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <Input
                        placeholder="Type your question about this feedback..."
                        value={userClarificationRequestInput}
                        onChange={(e) => setUserClarificationRequestInput(e.target.value)}
                        disabled={isFetchingClarification}
                    />
                    {isFetchingClarification && (
                        <div className="flex items-center text-sm text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Getting clarification...
                        </div>
                    )}
                    {clarificationError && !isFetchingClarification && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{clarificationError}</AlertDescription>
                        </Alert>
                    )}
                    {clarificationResponse && !isFetchingClarification && (
                        <Alert variant="default" className="bg-sky-50 border-sky-200">
                            <Lightbulb className="h-4 w-4 text-sky-600" />
                            <AlertTitle className="text-sky-700">AI Clarification:</AlertTitle>
                            <AlertDescription className="text-sky-700 whitespace-pre-wrap">
                                {clarificationResponse}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
                <DialogFooter className="sm:justify-end">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Close</Button>
                    </DialogClose>
                    <Button
                        type="button"
                        onClick={handleFetchClarification}
                        disabled={isFetchingClarification || !userClarificationRequestInput.trim() || !clarificationContext}
                    >
                        {isFetchingClarification ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Get Clarification
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>


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
    </>
  );
}


export default function InterviewSummaryPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center min-h-[60vh]"><Loader2 className="h-16 w-16 animate-spin text-primary mb-4" /><p className="text-xl text-muted-foreground">Loading summary...</p></div>}>
      <InterviewSummaryContent />
    </Suspense>
  );
}

