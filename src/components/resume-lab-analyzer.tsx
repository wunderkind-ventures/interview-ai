
"use client";

import React, { useState } from 'react';
import { getFirestore, collection, addDoc, serverTimestamp, query, getDocs, doc, setDoc, deleteDoc, orderBy } from "firebase/firestore";
import { useAuth } from '@/contexts/auth-context';
import { Button, buttonVariants } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, FileText, Briefcase, Sparkles, Lightbulb, AlertTriangle, CheckSquare, BarChartBig, ExternalLink, Save, List, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeResumeStandalone, type AnalyzeResumeStandaloneInput, type AnalyzeResumeStandaloneOutput } from '@/ai/flows/analyze-resume-standalone';
import { tailorResumeForJD, type TailorResumeForJDInput, type TailorResumeForJDOutput } from '@/ai/flows/tailor-resume-for-jd';
import type { ResumeAnalysis, ResumeTailoringSuggestions, SavedResume, SavedJobDescription } from '@/lib/types';
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

  // State for Resume Save/Load
  const [isSaveResumeDialogOpen, setIsSaveResumeDialogOpen] = useState(false);
  const [newResumeTitle, setNewResumeTitle] = useState("");
  const [isSavingResume, setIsSavingResume] = useState(false);
  const [isLoadResumeDialogOpen, setIsLoadResumeDialogOpen] = useState(false);
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [isLoadingResumes, setIsLoadingResumes] = useState(false);

  // State for Job Description Save/Load
  const [isSaveJobDescriptionDialogOpen, setIsSaveJobDescriptionDialogOpen] = useState(false);
  const [newJobDescriptionTitle, setNewJobDescriptionTitle] = useState("");
  const [isSavingJobDescription, setIsSavingJobDescription] = useState(false);
  const [isLoadJobDescriptionDialogOpen, setIsLoadJobDescriptionDialogOpen] = useState(false);
  const [savedJobDescriptions, setSavedJobDescriptions] = useState<SavedJobDescription[]>([]);
  const [isLoadingJobDescriptions, setIsLoadingJobDescriptions] = useState(false);


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
    setTailoringResult(null);
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
    setStandaloneAnalysisResult(null);
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

  // Resume Save/Load Logic
  const fetchSavedResumes = async () => {
    if (!user) return;
    setIsLoadingResumes(true);
    try {
      const db = getFirestore();
      const resumesCol = collection(db, 'users', user.uid, 'resumes');
      const q = query(resumesCol, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedResumes: SavedResume[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedResumes.push({ id: docSnap.id, ...docSnap.data() } as SavedResume);
      });
      setSavedResumes(fetchedResumes);
    } catch (error) {
      console.error("Error fetching resumes:", error);
      toast({ title: "Error", description: "Could not load saved resumes.", variant: "destructive" });
    } finally {
      setIsLoadingResumes(false);
    }
  };

  const handleOpenLoadResumeDialog = () => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to load saved resumes.", variant: "default" });
      return;
    }
    fetchSavedResumes();
    setIsLoadResumeDialogOpen(true);
  };

  const handleSaveCurrentResume = async () => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to save your resume.", variant: "default" });
      return;
    }
    if (!newResumeTitle.trim()) {
      toast({ title: "Title Required", description: "Please enter a title for your resume.", variant: "destructive" });
      return;
    }
    if (!resumeText.trim()) {
      toast({ title: "No Content", description: "Resume content is empty. Nothing to save.", variant: "default" });
      return;
    }

    setIsSavingResume(true);
    try {
      const db = getFirestore();
      const resumeData: Omit<SavedResume, 'id'> = {
        userId: user.uid,
        title: newResumeTitle,
        content: resumeText,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'users', user.uid, 'resumes'), resumeData);
      toast({ title: "Resume Saved", description: `"${newResumeTitle}" has been saved.` });
      setIsSaveResumeDialogOpen(false);
      setNewResumeTitle("");
      if (isLoadResumeDialogOpen) fetchSavedResumes(); // Refresh list if load dialog was open
    } catch (error) {
      console.error("Error saving resume:", error);
      const description = error instanceof Error ? error.message : "Could not save resume.";
      toast({ title: "Error Saving Resume", description, variant: "destructive" });
    } finally {
      setIsSavingResume(false);
    }
  };

  const handleLoadResume = (resume: SavedResume) => {
    setResumeText(resume.content);
    toast({ title: "Resume Loaded", description: `"${resume.title}" has been loaded.` });
    setIsLoadResumeDialogOpen(false);
  };

  const handleDeleteResume = async (resumeId: string) => {
    if (!user || !resumeId) return;
    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'users', user.uid, 'resumes', resumeId));
      toast({ title: "Resume Deleted", description: "The resume has been deleted." });
      fetchSavedResumes();
    } catch (error) {
      console.error("Error deleting resume:", error);
      toast({ title: "Error", description: "Could not delete resume.", variant: "destructive" });
    }
  };

  // Job Description Save/Load Logic
  const fetchSavedJobDescriptions = async () => {
    if (!user) return;
    setIsLoadingJobDescriptions(true);
    try {
      const db = getFirestore();
      const jdCol = collection(db, 'users', user.uid, 'jobDescriptions');
      const q = query(jdCol, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedJds: SavedJobDescription[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedJds.push({ id: docSnap.id, ...docSnap.data() } as SavedJobDescription);
      });
      setSavedJobDescriptions(fetchedJds);
    } catch (error) {
      console.error("Error fetching job descriptions:", error);
      toast({ title: "Error", description: "Could not load saved job descriptions.", variant: "destructive" });
    } finally {
      setIsLoadingJobDescriptions(false);
    }
  };

  const handleOpenLoadJobDescriptionDialog = () => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to load saved job descriptions.", variant: "default" });
      return;
    }
    fetchSavedJobDescriptions();
    setIsLoadJobDescriptionDialogOpen(true);
  };

  const handleSaveCurrentJobDescription = async () => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to save your job description.", variant: "default" });
      return;
    }
    if (!newJobDescriptionTitle.trim()) {
      toast({ title: "Title Required", description: "Please enter a title for your job description.", variant: "destructive" });
      return;
    }
    if (!jobDescriptionText.trim()) {
      toast({ title: "No Content", description: "Job description content is empty. Nothing to save.", variant: "default" });
      return;
    }

    setIsSavingJobDescription(true);
    try {
      const db = getFirestore();
      const jdData: Omit<SavedJobDescription, 'id'> = {
        userId: user.uid,
        title: newJobDescriptionTitle,
        content: jobDescriptionText,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'users', user.uid, 'jobDescriptions'), jdData);
      toast({ title: "Job Description Saved", description: `"${newJobDescriptionTitle}" has been saved.` });
      setIsSaveJobDescriptionDialogOpen(false);
      setNewJobDescriptionTitle("");
      if(isLoadJobDescriptionDialogOpen) fetchSavedJobDescriptions();
    } catch (error) {
      console.error("Error saving job description:", error);
      const description = error instanceof Error ? error.message : "Could not save job description.";
      toast({ title: "Error Saving Job Description", description, variant: "destructive" });
    } finally {
      setIsSavingJobDescription(false);
    }
  };

  const handleLoadJobDescription = (jd: SavedJobDescription) => {
    setJobDescriptionText(jd.content);
    toast({ title: "Job Description Loaded", description: `"${jd.title}" has been loaded.` });
    setIsLoadJobDescriptionDialogOpen(false);
  };

  const handleDeleteJobDescription = async (jdId: string) => {
    if (!user || !jdId) return;
    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'users', user.uid, 'jobDescriptions', jdId));
      toast({ title: "Job Description Deleted", description: "The job description has been deleted." });
      fetchSavedJobDescriptions();
    } catch (error) {
      console.error("Error deleting job description:", error);
      toast({ title: "Error", description: "Could not delete job description.", variant: "destructive" });
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
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="resumeText" className="block text-lg font-medium text-foreground">
                Your Resume
              </label>
              <div className="flex items-center space-x-2">
                <Dialog open={isSaveResumeDialogOpen} onOpenChange={setIsSaveResumeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm" disabled={!user || !resumeText.trim()} onClick={() => setNewResumeTitle("")}>
                      <Save className="mr-2 h-4 w-4" /> Save
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Save Resume</DialogTitle><DialogDescription>Enter a title for this resume.</DialogDescription></DialogHeader>
                    <Input placeholder="e.g., My FAANG Resume" value={newResumeTitle} onChange={(e) => setNewResumeTitle(e.target.value)} className="my-4" />
                    <DialogFooter>
                      <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                      <Button onClick={handleSaveCurrentResume} disabled={isSavingResume || !newResumeTitle.trim()}>
                        {isSavingResume && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={isLoadResumeDialogOpen} onOpenChange={setIsLoadResumeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm" disabled={!user} onClick={handleOpenLoadResumeDialog}>
                      <List className="mr-2 h-4 w-4" /> Load
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Load Saved Resume</DialogTitle><DialogDescription>Select a resume to load.</DialogDescription></DialogHeader>
                    {isLoadingResumes ? <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                      : savedResumes.length > 0 ? (
                        <ScrollArea className="h-[200px] my-4">
                          <div className="space-y-2 pr-2">
                            {savedResumes.map((res) => (
                              <Card key={res.id} className="p-3 flex justify-between items-center hover:bg-secondary/50">
                                <div><p className="font-medium text-sm">{res.title}</p><p className="text-xs text-muted-foreground">Saved: {res.createdAt?.toDate ? res.createdAt.toDate().toLocaleDateString() : 'N/A'}</p></div>
                                <div className="flex items-center space-x-1">
                                  <Button variant="ghost" size="sm" onClick={() => handleLoadResume(res)}>Load</Button>
                                  <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Resume?</AlertDialogTitle><AlertDialogDescription>Delete "{res.title}"? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteResume(res.id!)} className={buttonVariants({ variant: "destructive" })}>Delete</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : <p className="text-sm text-muted-foreground text-center py-4">No saved resumes.</p>}
                    <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <Textarea
              id="resumeText"
              placeholder="Paste your full resume content here..."
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="min-h-[250px] text-sm border-input focus:ring-primary focus:border-primary"
              rows={15}
            />
            <p className="text-xs text-muted-foreground mt-1">Ensure your resume is detailed for the best analysis (min. 100 characters). {!user && <span className="text-amber-600">(Login to save/load resumes)</span>}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="jobDescriptionText" className="block text-lg font-medium text-foreground">
                Job Description (Optional, for Tailoring)
              </label>
              <div className="flex items-center space-x-2">
                 <Dialog open={isSaveJobDescriptionDialogOpen} onOpenChange={setIsSaveJobDescriptionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm" disabled={!user || !jobDescriptionText.trim()} onClick={() => setNewJobDescriptionTitle("")}>
                      <Save className="mr-2 h-4 w-4" /> Save
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Save Job Description</DialogTitle><DialogDescription>Enter a title for this job description.</DialogDescription></DialogHeader>
                    <Input placeholder="e.g., Senior PM JD, Google" value={newJobDescriptionTitle} onChange={(e) => setNewJobDescriptionTitle(e.target.value)} className="my-4" />
                    <DialogFooter>
                      <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                      <Button onClick={handleSaveCurrentJobDescription} disabled={isSavingJobDescription || !newJobDescriptionTitle.trim()}>
                        {isSavingJobDescription && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={isLoadJobDescriptionDialogOpen} onOpenChange={setIsLoadJobDescriptionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm" disabled={!user} onClick={handleOpenLoadJobDescriptionDialog}>
                      <List className="mr-2 h-4 w-4" /> Load
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Load Saved Job Description</DialogTitle><DialogDescription>Select a JD to load.</DialogDescription></DialogHeader>
                    {isLoadingJobDescriptions ? <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                      : savedJobDescriptions.length > 0 ? (
                        <ScrollArea className="h-[200px] my-4">
                          <div className="space-y-2 pr-2">
                            {savedJobDescriptions.map((jd) => (
                              <Card key={jd.id} className="p-3 flex justify-between items-center hover:bg-secondary/50">
                                <div><p className="font-medium text-sm">{jd.title}</p><p className="text-xs text-muted-foreground">Saved: {jd.createdAt?.toDate ? jd.createdAt.toDate().toLocaleDateString() : 'N/A'}</p></div>
                                <div className="flex items-center space-x-1">
                                  <Button variant="ghost" size="sm" onClick={() => handleLoadJobDescription(jd)}>Load</Button>
                                   <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Job Description?</AlertDialogTitle><AlertDialogDescription>Delete "{jd.title}"? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteJobDescription(jd.id!)} className={buttonVariants({ variant: "destructive" })}>Delete</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : <p className="text-sm text-muted-foreground text-center py-4">No saved job descriptions.</p>}
                    <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <Textarea
              id="jobDescriptionText"
              placeholder="Paste the full job description here if you want tailoring suggestions..."
              value={jobDescriptionText}
              onChange={(e) => setJobDescriptionText(e.target.value)}
              className="min-h-[200px] text-sm border-input focus:ring-primary focus:border-primary"
              rows={10}
            />
            <p className="text-xs text-muted-foreground mt-1">Provide a JD to get suggestions on how to adapt your resume (min. 100 characters). {!user && <span className="text-amber-600">(Login to save/load JDs)</span>}</p>
          </div>

          {!user && (
             <Alert variant="default" className="bg-yellow-50 border-yellow-300 text-yellow-700">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <AlertTitle>Login Required</AlertTitle>
              <AlertDescription>
                Please log in to use the Resume Lab analysis features and save/load your documents.
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

    