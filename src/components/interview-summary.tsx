
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle, Home, MessageSquare, Edit, Sparkles, FileText, TimerIcon, Building, Briefcase, ThumbsUp, TrendingDown, Lightbulb, MessageCircle, CheckSquare, Layers, Search, BookOpen, AlertTriangle, SearchCheck, Star, HelpCircle, Info, BookMarked, Download } from "lucide-react"; 
import { LOCAL_STORAGE_KEYS } from "@/lib/constants";
import type { InterviewSessionData, FeedbackItem, DeepDiveFeedback, InterviewQuestion } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { generateInterviewFeedback } from "@/ai/flows/generate-interview-feedback";
import type { GenerateInterviewFeedbackInput } from "@/ai/flows/generate-interview-feedback";
import { generateDeepDiveFeedback } from "@/ai/flows/generate-deep-dive-feedback";
import type { GenerateDeepDiveFeedbackInput, GenerateDeepDiveFeedbackOutput } from "@/ai/flows/generate-deep-dive-feedback";
import { generateSampleAnswer } from "@/ai/flows/generate-sample-answer";
import type { GenerateSampleAnswerInput, GenerateSampleAnswerOutput } from "@/ai/flows/generate-sample-answer";
import { formatMilliseconds } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";


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

export default function InterviewSummary() {
  const router = useRouter();
  const { toast } = useToast();
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
        jobTitle: currentSession.jobTitle,
        jobDescription: currentSession.jobDescription,
        resume: currentSession.resume,
        interviewFocus: currentSession.interviewFocus,
      };

      const feedbackResult = await generateInterviewFeedback(feedbackInput);

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
      try {
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
      } catch (e) {
        console.error("Error parsing session data:", e);
        toast({ title: "Session Error", description: "Could not load session data. Please start a new interview.", variant: "destructive"});
        localStorage.removeItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION);
        router.replace("/");
        return;
      }
    } else {
      toast({ title: "No Interview Data", description: "Please start an interview first.", variant: "destructive"});
      router.replace("/");
      setIsSessionLoading(false);
    }
  }, [router, toast, fetchAndSetFeedback]);

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
        return updatedSession;
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate deep dive feedback.";
      setDeepDiveError(errorMessage);
      toast({ title: "Deep Dive Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsDeepDiveLoading(false);
    }
  };

  const handleOpenSampleAnswer = async (questionId: string) => {
    if (!sessionData) return;
    const question = sessionData.questions.find(q => q.id === questionId);
    if (!question) {
        toast({ title: "Error", description: "Question not found.", variant: "destructive" });
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
        return updatedSession;
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate sample answer.";
      setSampleAnswerError(errorMessage);
      toast({ title: "Sample Answer Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSampleAnswerLoading(false);
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
      md += `- **Type**: ${sessionData.interviewType}\n`;
      md += `- **Style**: ${sessionData.interviewStyle}\n`;
      md += `- **Level**: ${sessionData.faangLevel}\n`;
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
        md += `> ${answer.answerText.replace(/\n/g, '\n> ')}\n`; // Blockquote for answer
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
    toast({ title: "Export Successful", description: "Your interview summary has been downloaded." });
  };


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

  const getAnswerInfoForQuestion = (questionId: string): { answerText: string; timeTakenMs?: number; confidenceScore?: number } => {
    const answerObj = sessionData.answers.find(ans => ans.questionId === questionId);
    return {
      answerText: answerObj ? answerObj.answerText : "No answer provided.",
      timeTakenMs: answerObj?.timeTakenMs,
      confidenceScore: answerObj?.confidenceScore,
    };
  };

  const getFeedbackItemForQuestion = (questionId: string): FeedbackItem | undefined => {
    return sessionData.feedback?.feedbackItems.find(item => item.questionId === questionId);
  }

  const isTakeHomeStyle = sessionData.interviewStyle === 'take-home';

  const renderFeedbackSection = (title: string, items: string[] | undefined, icon: React.ReactNode, badgeVariant: "default" | "secondary" | "destructive" | "outline" = "secondary", itemClassName?: string) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mt-3">
        <h5 className="font-semibold text-muted-foreground mb-2 flex items-center">
          {icon}
          {title}:
        </h5>
        <ul className="list-none space-y-1 pl-0">
          {items.map((item, idx) => (
            <li key={idx} className={`flex items-start ${itemClassName}`}>
               <Badge variant={badgeVariant} className="mr-2 mt-1 text-xs whitespace-normal break-words">{item}</Badge>
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
            <div>Summary for your {sessionData.interviewType} ({sessionData.interviewStyle}) interview. Level: {sessionData.faangLevel}.</div>
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
                                    <div className="mt-2 p-2 rounded-md bg-blue-50 border border-blue-200">
                                      <h5 className="text-xs font-semibold text-blue-700 mb-1 flex items-center"><Info className="h-3.5 w-3.5 mr-1.5"/>AI's Ideal Answer Characteristics (for Assignment Design):</h5>
                                      <ul className="list-disc list-inside pl-1 space-y-0.5">
                                        {question.idealAnswerCharacteristics.map((char, idx) => (
                                          <li key={idx} className="text-xs text-blue-600">{char}</li>
                                        ))}
                                      </ul>
                                    </div>
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
                                      {renderFeedbackSection("Points to Reflect On", feedbackItem.reflectionPrompts, <HelpCircle className="h-4 w-4 mr-2 text-teal-500" />, "secondary", "text-sm")}
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
                                <div className="mb-2 p-2 rounded-md bg-blue-50 border border-blue-200">
                                  <h5 className="text-xs font-semibold text-blue-700 mb-1 flex items-center"><Info className="h-3.5 w-3.5 mr-1.5"/>AI's Ideal Answer Characteristics (for Question Design):</h5>
                                  <ul className="list-disc list-inside pl-1 space-y-0.5">
                                    {question.idealAnswerCharacteristics.map((char, idx) => (
                                      <li key={idx} className="text-xs text-blue-600">{char}</li>
                                    ))}
                                  </ul>
                                </div>
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
                                      {renderFeedbackSection("Points to Reflect On", feedbackItem.reflectionPrompts, <HelpCircle className="h-4 w-4 mr-2 text-teal-500" />, "secondary", "text-sm")}
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
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No Answers Recorded</AlertTitle>
                  <AlertDescription>
                    It looks like no answers were submitted for this session, so feedback cannot be generated.
                  </AlertDescription>
              </Alert>
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
                    {renderFeedbackSection("Detailed Ideal Answer Breakdown", deepDiveContent.detailedIdealAnswerBreakdown, <CheckSquare className="h-5 w-5 text-green-600" />, "secondary", "text-sm")}
                    {renderFeedbackSection("Alternative Approaches", deepDiveContent.alternativeApproaches, <Lightbulb className="h-5 w-5 text-blue-600" />, "secondary", "text-sm")}
                    {renderFeedbackSection("Follow-up Scenarios / Probing Questions", deepDiveContent.followUpScenarios, <Search className="h-5 w-5 text-purple-600" />, "secondary", "text-sm")}
                    {renderFeedbackSection("Suggested Study Concepts", deepDiveContent.suggestedStudyConcepts, <BookOpen className="h-5 w-5 text-orange-600" />, "secondary", "text-sm")}
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
                <DialogDescription className="pt-2">
                  For question: <span className="font-semibold">"{currentSampleAnswerQuestionText}"</span>
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-6 max-h-[70vh] overflow-y-auto pr-2">
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
                // Simple camelCase to Title Case conversion for labels
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
