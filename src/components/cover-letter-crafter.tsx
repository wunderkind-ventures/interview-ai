
"use client";

import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, orderBy, getDocs, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { Button, buttonVariants } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Sparkles, FileText, ClipboardCopy, AlertTriangle, Building, User, Edit3, MailPlus, List, Trash2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateCoverLetter, type GenerateCoverLetterInput, type GenerateCoverLetterOutput } from '@/ai/flows/generate-cover-letter';
import type { SavedJobDescription, SavedResume } from '@/lib/types';

type CoverLetterTone = "professional" | "enthusiastic" | "formal" | "slightly-informal";

const toneOptions: { value: CoverLetterTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "enthusiastic", label: "Enthusiastic" },
  { value: "formal", label: "Formal" },
  { value: "slightly-informal", label: "Slightly Informal" },
];

export default function CoverLetterCrafter() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [achievementsText, setAchievementsText] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [hiringManagerName, setHiringManagerName] = useState("");
  const [tone, setTone] = useState<CoverLetterTone>("professional");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // State for Job Description Load/Save
  const [isLoadJobDescriptionDialogOpen, setIsLoadJobDescriptionDialogOpen] = useState(false);
  const [savedJobDescriptions, setSavedJobDescriptions] = useState<SavedJobDescription[]>([]);
  const [isLoadingJobDescriptions, setIsLoadingJobDescriptions] = useState(false);
  const [isSaveJobDescriptionDialogOpen, setIsSaveJobDescriptionDialogOpen] = useState(false);
  const [newJobDescriptionTitle, setNewJobDescriptionTitle] = useState("");
  const [isSavingJobDescription, setIsSavingJobDescription] = useState(false);

  // State for Resume Load/Save
  const [isLoadResumeDialogOpen, setIsLoadResumeDialogOpen] = useState(false);
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [isLoadingResumes, setIsLoadingResumes] = useState(false);
  const [isSaveResumeDialogOpen, setIsSaveResumeDialogOpen] = useState(false);
  const [newResumeTitle, setNewResumeTitle] = useState("");
  const [isSavingResume, setIsSavingResume] = useState(false);


  const handleGenerateCoverLetter = async () => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to use the Cover Letter Crafter.", variant: "default" });
      return;
    }
    if (jobDescriptionText.trim().length < 50 || resumeText.trim().length < 100 || !companyName.trim()) {
      toast({
        title: "Input Required",
        description: "Please provide Job Description (min 50 chars), Resume (min 100 chars), and Company Name.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedDraft(null);
    setGenerationError(null);

    try {
      const input: GenerateCoverLetterInput = {
        jobDescriptionText,
        resumeText,
        achievementsText: achievementsText.trim() || undefined,
        userNotes: userNotes.trim() || undefined,
        companyName,
        hiringManagerName: hiringManagerName.trim() || undefined,
        tone,
      };
      const result = await generateCoverLetter(input);
      if (result.coverLetterDraft.startsWith("Error:")) {
        setGenerationError(result.coverLetterDraft);
        toast({ title: "Generation Error", description: result.coverLetterDraft, variant: "destructive" });
      } else {
        setGeneratedDraft(result.coverLetterDraft);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to generate cover letter.";
      setGenerationError(msg);
      toast({ title: "Generation Error", description: msg, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (generatedDraft) {
      navigator.clipboard.writeText(generatedDraft)
        .then(() => {
          toast({ title: "Copied!", description: "Cover letter draft copied to clipboard." });
        })
        .catch(err => {
          toast({ title: "Copy Failed", description: "Could not copy text. Please try manually.", variant: "destructive" });
          console.error('Failed to copy text: ', err);
        });
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
      fetchSavedJobDescriptions(); // Refresh the list
    } catch (error) {
      console.error("Error deleting job description:", error);
      toast({ title: "Error", description: "Could not delete job description.", variant: "destructive" });
    }
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
      if(isLoadJobDescriptionDialogOpen) fetchSavedJobDescriptions(); // Refresh list if load dialog was open
    } catch (error) {
      console.error("Error saving job description:", error);
      const description = error instanceof Error ? error.message : "Could not save job description.";
      toast({ title: "Error Saving Job Description", description, variant: "destructive" });
    } finally {
      setIsSavingJobDescription(false);
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
      if(isLoadResumeDialogOpen) fetchSavedResumes();
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


  if (authLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading Cover Letter Crafter...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-primary flex items-center justify-center">
            <MailPlus className="mr-3 h-8 w-8" /> AI Cover Letter Crafter
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground pt-1">
            Provide your details and the job description to generate a tailored cover letter draft.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!user && (
             <Alert variant="default" className="bg-yellow-50 border-yellow-300 text-yellow-700">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <AlertTitle>Login Required</AlertTitle>
              <AlertDescription>
                Please log in to use the Cover Letter Crafter and save/load your documents.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-foreground mb-1">Company Name *</label>
              <Input id="companyName" placeholder="e.g., Google, Netflix" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="hiringManagerName" className="block text-sm font-medium text-foreground mb-1">Hiring Manager Name (Optional)</label>
              <Input id="hiringManagerName" placeholder="e.g., Jane Doe" value={hiringManagerName} onChange={(e) => setHiringManagerName(e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="tone" className="block text-sm font-medium text-foreground mb-1">Desired Tone *</label>
            <Select value={tone} onValueChange={(value: string) => setTone(value as CoverLetterTone)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tone" />
              </SelectTrigger>
              <SelectContent>
                {toneOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="jobDescriptionText" className="block text-sm font-medium text-foreground">Job Description *</label>
              <div className="flex items-center space-x-2">
                <Dialog open={isSaveJobDescriptionDialogOpen} onOpenChange={setIsSaveJobDescriptionDialogOpen}>
                    <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm" disabled={!user || !jobDescriptionText.trim()} onClick={() => setNewJobDescriptionTitle("")}>
                        <Save className="mr-2 h-4 w-4" /> Save this JD
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                        <DialogTitle>Save Job Description</DialogTitle>
                        <DialogDescription>Enter a title for this job description to save it for later use.</DialogDescription>
                        </DialogHeader>
                        <Input
                        placeholder="e.g., Senior PM JD, Google L5 Eng JD"
                        value={newJobDescriptionTitle}
                        onChange={(e) => setNewJobDescriptionTitle(e.target.value)}
                        className="my-4"
                        />
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
                        <List className="mr-2 h-4 w-4" /> Load Saved JD
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                          <DialogTitle>Load Saved Job Description</DialogTitle>
                          <DialogDescription>Select a job description to load into the form.</DialogDescription>
                      </DialogHeader>
                      {isLoadingJobDescriptions ? (
                          <div className="flex justify-center items-center h-32">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                      ) : savedJobDescriptions.length > 0 ? (
                          <ScrollArea className="h-[200px] my-4">
                              <div className="space-y-2 pr-2">
                              {savedJobDescriptions.map((jd) => (
                                  <Card key={jd.id} className="p-3 flex justify-between items-center hover:bg-secondary/50 transition-colors">
                                      <div>
                                          <p className="font-medium text-sm">{jd.title}</p>
                                          <p className="text-xs text-muted-foreground">
                                              Saved: {jd.createdAt?.toDate ? jd.createdAt.toDate().toLocaleDateString() : 'Date N/A'}
                                          </p>
                                      </div>
                                      <div className="flex items-center space-x-1">
                                          <Button variant="ghost" size="sm" onClick={() => handleLoadJobDescription(jd)}>Load</Button>
                                          <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive">
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                  </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                  <AlertDialogHeader>
                                                      <AlertDialogTitle>Delete Job Description?</AlertDialogTitle>
                                                      <AlertDialogDescription>
                                                          Are you sure you want to delete "{jd.title}"? This action cannot be undone.
                                                      </AlertDialogDescription>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter>
                                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                      <AlertDialogAction onClick={() => handleDeleteJobDescription(jd.id!)} className={buttonVariants({ variant: "destructive" })}>
                                                          Delete
                                                      </AlertDialogAction>
                                                  </AlertDialogFooter>
                                              </AlertDialogContent>
                                          </AlertDialog>
                                      </div>
                                  </Card>
                              ))}
                              </div>
                          </ScrollArea>
                      ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">No saved job descriptions found.</p>
                      )}
                      <DialogFooter>
                          <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                      </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <Textarea
              id="jobDescriptionText"
              placeholder="Paste the full job description here..."
              value={jobDescriptionText}
              onChange={(e) => setJobDescriptionText(e.target.value)}
              className="min-h-[150px] text-sm"
              rows={8}
            />
             <p className="text-xs text-muted-foreground mt-1">Min. 50 characters. {!user && <span className="text-amber-600">(Login to save/load JDs)</span>}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
                <label htmlFor="resumeText" className="block text-sm font-medium text-foreground">Your Resume *</label>
                <div className="flex items-center space-x-2">
                    <Dialog open={isSaveResumeDialogOpen} onOpenChange={setIsSaveResumeDialogOpen}>
                        <DialogTrigger asChild>
                            <Button type="button" variant="outline" size="sm" disabled={!user || !resumeText.trim()} onClick={() => setNewResumeTitle("")}>
                                <Save className="mr-2 h-4 w-4" /> Save this Resume
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Save Resume</DialogTitle><DialogDescription>Enter a title for this resume.</DialogDescription></DialogHeader>
                            <Input placeholder="e.g., My FAANG Resume, Data Science Resume v3" value={newResumeTitle} onChange={(e) => setNewResumeTitle(e.target.value)} className="my-4" />
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
                                <List className="mr-2 h-4 w-4" /> Load Saved Resume
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
              className="min-h-[200px] text-sm"
              rows={10}
            />
            <p className="text-xs text-muted-foreground mt-1">Min. 100 characters. {!user && <span className="text-amber-600">(Login to save/load resumes)</span>}</p>
          </div>

          <div>
            <label htmlFor="achievementsText" className="block text-sm font-medium text-foreground mb-1">Key Achievements to Highlight (Optional)</label>
            <Textarea
              id="achievementsText"
              placeholder="Paste 2-3 key achievements relevant to this job. e.g., 'Led a team of 5 to launch Product X, increasing user engagement by 20%.' or bullet points."
              value={achievementsText}
              onChange={(e) => setAchievementsText(e.target.value)}
              className="min-h-[100px] text-sm"
              rows={5}
            />
          </div>

          <div>
            <label htmlFor="userNotes" className="block text-sm font-medium text-foreground mb-1">Additional Notes for AI (Optional)</label>
            <Textarea
              id="userNotes"
              placeholder="e.g., 'Emphasize my passion for sustainability initiatives mentioned in the JD.' or 'Mention my specific experience with Python for data analysis.'"
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              className="min-h-[80px] text-sm"
              rows={3}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-4">
          <Button
            onClick={handleGenerateCoverLetter}
            disabled={isGenerating || !user || !jobDescriptionText.trim() || !resumeText.trim() || !companyName.trim()}
            className="w-full sm:w-auto text-base py-3 px-6 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-5 w-5" />
            )}
            Generate Cover Letter Draft
          </Button>
        </CardFooter>
      </Card>

      {(isGenerating || generatedDraft || generationError) && (
        <Card className="mt-8 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl text-primary flex items-center">
              <FileText className="mr-2 h-6 w-6" /> Generated Cover Letter Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isGenerating && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Crafting your cover letter...</p>
              </div>
            )}
            {generationError && !isGenerating && (
              <Alert variant="destructive">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle>Generation Error</AlertTitle>
                <AlertDescription>{generationError}</AlertDescription>
              </Alert>
            )}
            {generatedDraft && !isGenerating && (
              <>
                <Textarea
                  value={generatedDraft}
                  readOnly
                  className="min-h-[400px] text-sm bg-background border-input mb-4"
                  rows={20}
                />
                <Button onClick={handleCopyToClipboard} variant="outline" size="sm">
                  <ClipboardCopy className="mr-2 h-4 w-4" /> Copy to Clipboard
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
