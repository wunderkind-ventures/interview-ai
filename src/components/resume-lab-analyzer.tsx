
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FileText, Briefcase, Sparkles, Lightbulb, AlertTriangle, CheckSquare, BarChartBig, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeResumeStandalone, type AnalyzeResumeStandaloneInput, type AnalyzeResumeStandaloneOutput } from '@/ai/flows/analyze-resume-standalone';
import { tailorResumeForJD, type TailorResumeForJDInput, type TailorResumeForJDOutput } from '@/ai/flows/tailor-resume-for-jd';
import type { ResumeAnalysis, ResumeTailoringSuggestions } from '@/lib/types'; // Ensure these are defined in lib/types.ts
import { Badge } from './ui/badge';

export default function ResumeLabAnalyzer() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [resumeText, setResumeText] = useState("");
  const [jobDescriptionText, setJobDescriptionText] = useState("");

  const [isAnalyzingStandalone, setIsAnalyzingStandalone] = useState(false);
  const [standaloneAnalysisResult, setStandaloneAnalysisResult] = useState<ResumeAnalysis | null>(null);
  const [standaloneAnalysisError, setStandaloneAnalysisError] = useState<string | null>(null);

  const [isTailoring, setIsTailoring] = useState(false);
  const [tailoringResult, setTailoringResult] = useState<ResumeTailoringSuggestions | null>(null);
  const [tailoringError, setTailoringError] = useState<string | null>(null);

  const handleAnalyzeStandalone = async () => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to use the Resume Lab.", variant: "default" });
      return;
    }
    if (resumeText.trim().length < 100) {
      toast({ title: "Resume Too Short", description: "Please provide at least 100 characters for resume analysis.", variant: "destructive" });
      return;
    }
    setIsAnalyzingStandalone(true);
    setStandaloneAnalysisResult(null);
    setStandaloneAnalysisError(null);
    setTailoringResult(null); // Clear previous tailoring results
    setTailoringError(null);

    try {
      const input: AnalyzeResumeStandaloneInput = { resumeText };
      const result = await analyzeResumeStandalone(input);
      setStandaloneAnalysisResult(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to analyze resume.";
      setStandaloneAnalysisError(msg);
      toast({ title: "Analysis Error", description: msg, variant: "destructive" });
    } finally {
      setIsAnalyzingStandalone(false);
    }
  };

  const handleTailorResume = async () => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to use the Resume Lab.", variant: "default" });
      return;
    }
    if (resumeText.trim().length < 100 || jobDescriptionText.trim().length < 100) {
      toast({ title: "Input Required", description: "Please provide at least 100 characters for both resume and job description for tailoring.", variant: "destructive" });
      return;
    }
    setIsTailoring(true);
    setTailoringResult(null);
    setTailoringError(null);
    setStandaloneAnalysisResult(null); // Clear previous standalone results
    setStandaloneAnalysisError(null);


    try {
      const input: TailorResumeForJDInput = { resumeText, jobDescriptionText };
      const result = await tailorResumeForJD(input);
      setTailoringResult(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to get tailoring suggestions.";
      setTailoringError(msg);
      toast({ title: "Tailoring Error", description: msg, variant: "destructive" });
    } finally {
      setIsTailoring(false);
    }
  };

  const renderStars = (score: number, label: string) => (
    <div className="flex items-center">
      <span className="text-sm font-medium mr-2">{label}:</span>
      {[...Array(5)].map((_, i) => (
        <Sparkles
          key={i}
          className={`h-4 w-4 ${i < score ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
        />
      ))}
      <span className="ml-1.5 text-xs text-muted-foreground">({score}/5)</span>
    </div>
  );

  if (authLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading Resume Lab...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-primary flex items-center justify-center">
            <FileText className="mr-3 h-8 w-8" /> Resume Lab
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground pt-1">
            Paste your resume and an optional job description to get AI-powered feedback and tailoring suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label htmlFor="resumeText" className="block text-lg font-medium text-foreground mb-2">
              Your Resume
            </label>
            <Textarea
              id="resumeText"
              placeholder="Paste your full resume content here..."
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="min-h-[250px] text-sm border-input focus:ring-primary focus:border-primary"
              rows={15}
            />
            <p className="text-xs text-muted-foreground mt-1">Ensure your resume is detailed for the best analysis (min. 100 characters).</p>
          </div>

          <div>
            <label htmlFor="jobDescriptionText" className="block text-lg font-medium text-foreground mb-2">
              Job Description (Optional, for Tailoring)
            </label>
            <Textarea
              id="jobDescriptionText"
              placeholder="Paste the full job description here if you want tailoring suggestions..."
              value={jobDescriptionText}
              onChange={(e) => setJobDescriptionText(e.target.value)}
              className="min-h-[200px] text-sm border-input focus:ring-primary focus:border-primary"
              rows={10}
            />
            <p className="text-xs text-muted-foreground mt-1">Provide a JD to get suggestions on how to adapt your resume (min. 100 characters).</p>
          </div>

          {!user && (
             <Alert variant="default" className="bg-yellow-50 border-yellow-300 text-yellow-700">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <AlertTitle>Login Required</AlertTitle>
              <AlertDescription>
                Please log in to use the Resume Lab analysis features.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-4">
          <Button
            onClick={handleAnalyzeStandalone}
            disabled={isAnalyzingStandalone || isTailoring || !resumeText.trim() || !user}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isAnalyzingStandalone ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Analyze My Resume
          </Button>
          <Button
            onClick={handleTailorResume}
            disabled={isTailoring || isAnalyzingStandalone || !resumeText.trim() || !jobDescriptionText.trim() || !user}
            className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {isTailoring ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Briefcase className="mr-2 h-4 w-4" />
            )}
            Get Tailoring Suggestions
          </Button>
        </CardFooter>
      </Card>

      {/* Standalone Resume Analysis Results */}
      {(isAnalyzingStandalone || standaloneAnalysisResult || standaloneAnalysisError) && (
        <Card className="mt-8 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl text-primary flex items-center">
              <Lightbulb className="mr-2 h-6 w-6" /> Standalone Resume Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isAnalyzingStandalone && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing your resume...</p>
              </div>
            )}
            {standaloneAnalysisError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle>Analysis Error</AlertTitle>
                <AlertDescription>{standaloneAnalysisError}</AlertDescription>
              </Alert>
            )}
            {standaloneAnalysisResult && !isAnalyzingStandalone && (
              <div className="space-y-4 text-sm">
                <Alert variant="default" className="bg-background">
                  <BarChartBig className="h-5 w-5 text-primary" />
                  <AlertTitle className="font-semibold">Overall Feedback:</AlertTitle>
                  <AlertDescription>{standaloneAnalysisResult.overallFeedback}</AlertDescription>
                </Alert>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderStars(standaloneAnalysisResult.clarityScore, "Clarity Score")}
                  {renderStars(standaloneAnalysisResult.impactScore, "Impact Score")}
                </div>
                 <div>
                  <h4 className="font-semibold text-muted-foreground mb-1.5 flex items-center"><CheckSquare className="h-4 w-4 mr-2 text-green-500"/>Strengths:</h4>
                  <ul className="list-disc space-y-1 pl-5">
                    {standaloneAnalysisResult.strengths.map((s, i) => <li key={`str-${i}`}>{s}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1.5 flex items-center"><AlertTriangle className="h-4 w-4 mr-2 text-orange-500"/>Areas for Improvement:</h4>
                  <ul className="list-disc space-y-1 pl-5">
                    {standaloneAnalysisResult.areasForImprovement.map((a, i) => <li key={`area-${i}`}>{a}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1.5 flex items-center"><Sparkles className="h-4 w-4 mr-2 text-blue-500"/>Actionable Suggestions:</h4>
                  <ul className="list-disc space-y-1 pl-5">
                    {standaloneAnalysisResult.actionableSuggestions.map((s, i) => <li key={`sug-${i}`}>{s}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resume Tailoring Results */}
      {(isTailoring || tailoringResult || tailoringError) && (
        <Card className="mt-8 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl text-primary flex items-center">
              <Briefcase className="mr-2 h-6 w-6" /> Resume Tailoring for Job Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isTailoring && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Generating tailoring suggestions...</p>
              </div>
            )}
            {tailoringError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle>Tailoring Error</AlertTitle>
                <AlertDescription>{tailoringError}</AlertDescription>
              </Alert>
            )}
            {tailoringResult && !isTailoring && (
              <div className="space-y-4 text-sm">
                 <Alert variant="default" className="bg-background">
                  <BarChartBig className="h-5 w-5 text-primary" />
                  <AlertTitle className="font-semibold">Overall Fit Assessment:</AlertTitle>
                  <AlertDescription>{tailoringResult.overallFitAssessment}</AlertDescription>
                </Alert>
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1.5 flex items-center"><CheckSquare className="h-4 w-4 mr-2 text-green-500"/>Keywords from Job Description:</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {tailoringResult.keywordsFromJD.map((kw, i) => <Badge key={`jd-kw-${i}`} variant="secondary">{kw}</Badge>)}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1.5 flex items-center"><AlertTriangle className="h-4 w-4 mr-2 text-orange-500"/>Missing Keywords in Resume:</h4>
                   <div className="flex flex-wrap gap-1.5">
                    {tailoringResult.missingKeywordsInResume.length > 0 ?
                      tailoringResult.missingKeywordsInResume.map((kw, i) => <Badge key={`mis-kw-${i}`} variant="outline" className="border-orange-400 text-orange-600">{kw}</Badge>) :
                      <p className="text-xs text-muted-foreground italic">Good job! No major keywords seem to be missing.</p>
                    }
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1.5 flex items-center"><ExternalLink className="h-4 w-4 mr-2 text-purple-500"/>Relevant Experiences to Highlight:</h4>
                  <ul className="list-disc space-y-1 pl-5">
                    {tailoringResult.relevantExperiencesToHighlight.map((exp, i) => <li key={`exp-${i}`}>{exp}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1.5 flex items-center"><Sparkles className="h-4 w-4 mr-2 text-blue-500"/>Suggestions for Tailoring:</h4>
                  <ul className="list-disc space-y-1 pl-5">
                    {tailoringResult.suggestionsForTailoring.map((sug, i) => <li key={`tailor-sug-${i}`}>{sug}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
