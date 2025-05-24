
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Brain, FileText, UserCircle, Star, Workflow, Users, Loader2, MessagesSquare, ListChecks, Lightbulb, AlertTriangle, Target, Building, Layers, Briefcase, SearchCheck, PackageSearch, BrainCircuit, Code2, UploadCloud, Save, List, AlertCircle, Trash2, Cog, HelpCircle, Users2 } from "lucide-react";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc, deleteDoc, orderBy } from "firebase/firestore";
import { useAuth } from '@/contexts/auth-context';

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


import { INTERVIEW_TYPES, FAANG_LEVELS, LOCAL_STORAGE_KEYS, type InterviewType, type FaangLevel, INTERVIEW_STYLES, type InterviewStyle, SKILLS_BY_INTERVIEW_TYPE, type Skill, THEMED_INTERVIEW_PACKS, type ThemedInterviewPack, type ThemedInterviewPackConfig, INTERVIEWER_PERSONAS, type InterviewerPersona } from "@/lib/constants";
import type { InterviewSetupData, SavedResume, SavedJobDescription, SavedInterviewSetup } from "@/lib/types";
import { summarizeResume } from "@/ai/flows/summarize-resume";
import type { SummarizeResumeOutput } from "@/ai/flows/summarize-resume";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  interviewType: z.custom<InterviewType>((val) => INTERVIEW_TYPES.some(it => it.value === val), {
    message: "Please select an interview type.",
  }),
  interviewStyle: z.custom<InterviewStyle>((val) => INTERVIEW_STYLES.some(is => is.value === val), {
    message: "Please select an interview style.",
  }),
  faangLevel: z.custom<FaangLevel>((val) => FAANG_LEVELS.some(fl => fl.value === val), {
    message: "Please select a FAANG level.",
  }),
  jobTitle: z.string().optional(),
  jobDescription: z.string().optional(),
  resume: z.string().optional(),
  targetedSkills: z.array(z.string()).optional(),
  targetCompany: z.string().optional(),
  interviewFocus: z.string().optional(),
  selectedThemeId: z.string().optional(),
  interviewerPersona: z.custom<InterviewerPersona | string>().optional(),
});

export default function InterviewSetupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [resumeSummary, setResumeSummary] = useState<string | null>(null);
  const [isSummarizingResume, setIsSummarizingResume] = useState(false);
  const [resumeSummaryError, setResumeSummaryError] = useState<string | null>(null);
  const [summarizedForResumeText, setSummarizedForResumeText] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSaveResumeDialogOpen, setIsSaveResumeDialogOpen] = useState(false);
  const [newResumeTitle, setNewResumeTitle] = useState("");
  const [isSavingResume, setIsSavingResume] = useState(false);
  const [isLoadResumeDialogOpen, setIsLoadResumeDialogOpen] = useState(false);
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [isLoadingResumes, setIsLoadingResumes] = useState(false);

  const [isSaveJobDescriptionDialogOpen, setIsSaveJobDescriptionDialogOpen] = useState(false);
  const [newJobDescriptionTitle, setNewJobDescriptionTitle] = useState("");
  const [isSavingJobDescription, setIsSavingJobDescription] = useState(false);
  const [isLoadJobDescriptionDialogOpen, setIsLoadJobDescriptionDialogOpen] = useState(false);
  const [savedJobDescriptions, setSavedJobDescriptions] = useState<SavedJobDescription[]>([]);
  const [isLoadingJobDescriptions, setIsLoadingJobDescriptions] = useState(false);

  const [isSaveSetupDialogOpen, setIsSaveSetupDialogOpen] = useState(false);
  const [newSetupTitle, setNewSetupTitle] = useState("");
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [isLoadSetupDialogOpen, setIsLoadSetupDialogOpen] = useState(false);
  const [savedSetups, setSavedSetups] = useState<SavedInterviewSetup[]>([]);
  const [isLoadingSetups, setIsLoadingSetups] = useState(false);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      interviewType: INTERVIEW_TYPES[0].value,
      interviewStyle: INTERVIEW_STYLES[0].value,
      faangLevel: FAANG_LEVELS[1].value,
      jobTitle: "",
      jobDescription: "",
      resume: "",
      targetedSkills: [],
      targetCompany: "",
      interviewFocus: "",
      selectedThemeId: "custom",
      interviewerPersona: INTERVIEWER_PERSONAS[0].value,
    },
  });

  const watchedInterviewType = form.watch("interviewType");
  const currentResumeContent = form.watch("resume");
  const currentJobDescriptionContent = form.watch("jobDescription");

  const availableSkills: Skill[] = useMemo(() => {
    return SKILLS_BY_INTERVIEW_TYPE[watchedInterviewType] || [];
  }, [watchedInterviewType]);

  useEffect(() => {
    if (form.getValues("selectedThemeId") === "custom" && availableSkills.length > 0) {
      const currentTargetedSkills = form.getValues("targetedSkills") || [];
      const validCurrentTargetedSkills = currentTargetedSkills.filter(skillVal =>
        availableSkills.some(s => s.value === skillVal)
      );
      if (currentTargetedSkills.length !== validCurrentTargetedSkills.length) {
        form.setValue("targetedSkills", validCurrentTargetedSkills);
      }
    } else if (form.getValues("selectedThemeId") !== "custom") {
        // Theme is selected, skills are handled by handleThemeChange
    } else {
        form.setValue("targetedSkills", []);
    }
  }, [watchedInterviewType, availableSkills, form]);


  const handleResumeAnalysis = async () => {
    const currentResumeText = form.getValues('resume');
    if (!currentResumeText || currentResumeText.trim() === "") {
      setResumeSummary(null);
      setResumeSummaryError(null);
      setSummarizedForResumeText(null);
      setIsSummarizingResume(false);
      return;
    }

    if (currentResumeText === summarizedForResumeText && !resumeSummaryError) {
      return;
    }

    setIsSummarizingResume(true);
    setResumeSummary(null);
    setResumeSummaryError(null);

    try {
      const result: SummarizeResumeOutput = await summarizeResume({ resume: currentResumeText });
      setResumeSummary(result.summary);
      setSummarizedForResumeText(currentResumeText);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze resume.";
      setResumeSummaryError(errorMessage);
      toast({
        title: "Resume Analysis Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSummarizingResume(false);
    }
  };

  useEffect(() => {
    const storedSetup = localStorage.getItem(LOCAL_STORAGE_KEYS.INTERVIEW_SETUP);
    if (storedSetup) {
      try {
        const parsedSetup = JSON.parse(storedSetup) as InterviewSetupData;
        form.reset({
          ...parsedSetup,
          selectedThemeId: parsedSetup.selectedThemeId || "custom",
          interviewerPersona: parsedSetup.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
        });
        if (parsedSetup.resume && parsedSetup.resume.trim() !== "") {
           setSummarizedForResumeText(parsedSetup.resume);
        }
      } catch (e) {
        console.error("Failed to parse stored interview setup:", e);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.INTERVIEW_SETUP);
      }
    }
  }, [form]);

  const handleThemeChange = (themeId: string) => {
    form.setValue("selectedThemeId", themeId);
    if (themeId === "custom") {
      const currentTargetedSkills = form.getValues("targetedSkills") || [];
      const validCurrentTargetedSkills = currentTargetedSkills.filter(skillVal =>
        availableSkills.some(s => s.value === skillVal)
      );
      form.setValue("targetedSkills", validCurrentTargetedSkills);
      form.setValue("interviewerPersona", INTERVIEWER_PERSONAS[0].value ) // Reset persona for custom
      return;
    }
    const selectedPack = THEMED_INTERVIEW_PACKS.find(pack => pack.id === themeId);
    if (selectedPack) {
      const { config } = selectedPack;
      const currentResume = form.getValues("resume");
      const currentJobDescriptionFromForm = form.getValues("jobDescription");
      const newFormValues: Partial<z.infer<typeof formSchema>> = {
        interviewType: config.interviewType || INTERVIEW_TYPES[0].value,
        interviewStyle: config.interviewStyle || INTERVIEW_STYLES[0].value,
        faangLevel: config.faangLevel || FAANG_LEVELS[1].value,
        jobTitle: config.jobTitle || "",
        jobDescription: config.jobDescription || currentJobDescriptionFromForm,
        targetedSkills: [],
        targetCompany: config.targetCompany || "",
        interviewFocus: config.interviewFocus || "",
        resume: currentResume,
        selectedThemeId: themeId,
        interviewerPersona: config.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
      };
      form.reset(newFormValues);

       setTimeout(() => {
        const themeInterviewType = config.interviewType || INTERVIEW_TYPES[0].value;
        const skillsForThemeType = SKILLS_BY_INTERVIEW_TYPE[themeInterviewType] || [];
        const validThemeSkills = (config.targetedSkills || []).filter(skillVal =>
            skillsForThemeType.some(s => s.value === skillVal)
        );
        form.setValue("targetedSkills", validThemeSkills);
      }, 0);

      setResumeSummary(null);
      setResumeSummaryError(null);
      setSummarizedForResumeText(currentResume);
      setSelectedFileName(null);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFileName(null);
      return;
    }

    if (file.type !== "text/plain") {
      toast({
        title: "Invalid File Type",
        description: "Please upload a .txt file for your resume.",
        variant: "destructive",
      });
      setSelectedFileName(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const textContent = e.target?.result as string;
      if (textContent) {
        form.setValue("resume", textContent);
        handleResumeAnalysis();
        toast({
          title: "Resume Uploaded",
          description: `${file.name} has been read successfully.`,
        });
      } else {
        toast({
          title: "File Read Error",
          description: "Could not read the content of the resume file.",
          variant: "destructive",
        });
         setSelectedFileName(null);
      }
    };
    reader.onerror = () => {
      toast({
        title: "File Read Error",
        description: "An error occurred while trying to read the resume file.",
        variant: "destructive",
      });
      setSelectedFileName(null);
    };
    reader.readAsText(file);
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const setupData: InterviewSetupData = {
        ...values,
        targetedSkills: values.targetedSkills || [],
        interviewerPersona: values.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
    };
    localStorage.setItem(LOCAL_STORAGE_KEYS.INTERVIEW_SETUP, JSON.stringify(setupData));
    localStorage.removeItem(LOCAL_STORAGE_KEYS.INTERVIEW_SESSION);
    router.push("/interview");
  }

  const getIconForType = (type: InterviewType) => {
    switch (type) {
      case "product sense": return <Brain className="mr-2 h-4 w-4" />;
      case "technical system design": return <Workflow className="mr-2 h-4 w-4" />;
      case "behavioral": return <Users className="mr-2 h-4 w-4" />;
      case "machine learning": return <BrainCircuit className="mr-2 h-4 w-4" />;
      case "data structures & algorithms": return <Code2 className="mr-2 h-4 w-4" />;
      default: return null;
    }
  };

  const getIconForStyle = (style: InterviewStyle) => {
    switch (style) {
      case "simple-qa": return <ListChecks className="mr-2 h-4 w-4" />;
      case "case-study": return <Layers className="mr-2 h-4 w-4" />;
      case "take-home": return <FileText className="mr-2 h-4 w-4" />;
      default: return null;
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
    const resumeContent = form.getValues("resume");
    if (!resumeContent || !resumeContent.trim()) {
      toast({ title: "No Content", description: "Resume content is empty. Nothing to save.", variant: "default" });
      return;
    }

    setIsSavingResume(true);
    try {
      const db = getFirestore();
      const resumeData: Omit<SavedResume, 'id'> = {
        userId: user.uid,
        title: newResumeTitle,
        content: resumeContent,
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
      toast({ title: "Error", description: "Could not save resume.", variant: "destructive" });
    } finally {
      setIsSavingResume(false);
    }
  };

  const handleLoadResume = (resume: SavedResume) => {
    form.setValue("resume", resume.content);
    toast({ title: "Resume Loaded", description: `"${resume.title}" has been loaded into the form.` });
    setIsLoadResumeDialogOpen(false);
    handleResumeAnalysis();
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
    const jdContent = form.getValues("jobDescription");
    if (!jdContent || !jdContent.trim()) {
      toast({ title: "No Content", description: "Job description content is empty. Nothing to save.", variant: "default" });
      return;
    }

    setIsSavingJobDescription(true);
    try {
      const db = getFirestore();
      const jdData: Omit<SavedJobDescription, 'id'> = {
        userId: user.uid,
        title: newJobDescriptionTitle,
        content: jdContent,
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
      const description = error instanceof Error ? error.message : "Could not save job description. Please check console for details.";
      toast({ title: "Error Saving Job Description", description, variant: "destructive" });
    } finally {
      setIsSavingJobDescription(false);
    }
  };

  const handleLoadJobDescription = (jd: SavedJobDescription) => {
    form.setValue("jobDescription", jd.content);
    toast({ title: "Job Description Loaded", description: `"${jd.title}" has been loaded into the form.` });
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

  const fetchSavedSetups = async () => {
    if (!user) return;
    setIsLoadingSetups(true);
    try {
      const db = getFirestore();
      const setupsCol = collection(db, 'users', user.uid, 'savedSetups');
      const q = query(setupsCol, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedSetups: SavedInterviewSetup[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedSetups.push({ id: docSnap.id, ...docSnap.data() } as SavedInterviewSetup);
      });
      setSavedSetups(fetchedSetups);
    } catch (error) {
      console.error("Error fetching saved setups:", error);
      toast({ title: "Error", description: "Could not load saved interview setups.", variant: "destructive" });
    } finally {
      setIsLoadingSetups(false);
    }
  };

  const handleOpenLoadSetupDialog = () => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to load saved setups.", variant: "default" });
      return;
    }
    fetchSavedSetups();
    setIsLoadSetupDialogOpen(true);
  };

  const handleSaveCurrentSetup = async () => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to save this setup.", variant: "default" });
      return;
    }
    if (!newSetupTitle.trim()) {
      toast({ title: "Title Required", description: "Please enter a title for this interview setup.", variant: "destructive" });
      return;
    }

    const currentConfig = form.getValues();
    const setupToSave: InterviewSetupData = {
        ...currentConfig,
        targetedSkills: currentConfig.targetedSkills || [],
        selectedThemeId: currentConfig.selectedThemeId || "custom",
        interviewerPersona: currentConfig.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
    };

    setIsSavingSetup(true);
    try {
      const db = getFirestore();
      const setupData: Omit<SavedInterviewSetup, 'id'> = {
        userId: user.uid,
        title: newSetupTitle,
        config: setupToSave,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'users', user.uid, 'savedSetups'), setupData);
      toast({ title: "Setup Saved", description: `Interview setup "${newSetupTitle}" has been saved.` });
      setIsSaveSetupDialogOpen(false);
      setNewSetupTitle("");
      if (isLoadSetupDialogOpen) fetchSavedSetups();
    } catch (error) {
      console.error("Error saving setup:", error);
      const description = error instanceof Error ? error.message : "Could not save setup.";
      toast({ title: "Error Saving Setup", description, variant: "destructive" });
    } finally {
      setIsSavingSetup(false);
    }
  };

  const handleLoadSetup = (setup: SavedInterviewSetup) => {
    form.reset({
      ...setup.config,
      selectedThemeId: setup.config.selectedThemeId || "custom",
      interviewerPersona: setup.config.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
    });
    toast({ title: "Setup Loaded", description: `"${setup.title}" interview setup has been loaded.` });
    setIsLoadSetupDialogOpen(false);
    if (setup.config.resume && setup.config.resume.trim() !== "") {
      setSummarizedForResumeText(setup.config.resume);
      handleResumeAnalysis();
    } else {
      setResumeSummary(null);
      setResumeSummaryError(null);
      setSummarizedForResumeText(null);
    }
  };

  const handleDeleteSetup = async (setupId: string) => {
    if (!user || !setupId) return;
    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'users', user.uid, 'savedSetups', setupId));
      toast({ title: "Setup Deleted", description: "The saved interview setup has been deleted." });
      fetchSavedSetups();
    } catch (error) {
      console.error("Error deleting setup:", error);
      toast({ title: "Error", description: "Could not delete saved setup.", variant: "destructive" });
    }
  };


  return (
    <>
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center text-primary">Start Your Mock Interview</CardTitle>
        <CardDescription className="text-center text-muted-foreground pt-1">
          Configure your interview session or choose a theme to get started quickly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card className="bg-secondary/30">
              <CardHeader>
                <CardTitle className="text-xl">Interview Configuration</CardTitle>
                <div className="flex flex-col sm:flex-row sm:items-end gap-2 pt-2 sm:pt-0 shrink-0">
                    <Dialog open={isLoadSetupDialogOpen} onOpenChange={setIsLoadSetupDialogOpen}>
                        <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm" disabled={!user || authLoading} onClick={handleOpenLoadSetupDialog} className="w-full sm:w-auto">
                            <Cog className="mr-2 h-4 w-4" /> Load Setup
                        </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            {/* Load Setup Dialog Content */}
                            <DialogHeader>
                                <DialogTitle>Load Saved Interview Setup</DialogTitle>
                                <DialogDescription>Select a setup to load into the form.</DialogDescription>
                            </DialogHeader>
                            {isLoadingSetups ? (
                                <div className="flex justify-center items-center h-32">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : savedSetups.length > 0 ? (
                                <ScrollArea className="h-[200px] my-4">
                                    <div className="space-y-2 pr-2">
                                    {savedSetups.map((setup) => (
                                        <Card key={setup.id} className="p-3 flex justify-between items-center hover:bg-background/80">
                                            <div>
                                                <p className="font-medium text-sm">{setup.title}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Saved: {setup.createdAt?.toDate ? setup.createdAt.toDate().toLocaleDateString() : 'Date N/A'}
                                                </p>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <Button variant="ghost" size="sm" onClick={() => handleLoadSetup(setup)}>Load</Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Saved Setup?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Are you sure you want to delete "{setup.title}"? This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteSetup(setup.id!)} className={buttonVariants({ variant: "destructive" })}>
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
                                <p className="text-sm text-muted-foreground text-center py-4">No saved interview setups found.</p>
                            )}
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={isSaveSetupDialogOpen} onOpenChange={setIsSaveSetupDialogOpen}>
                        <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm" disabled={!user || authLoading} className="w-full sm:w-auto">
                            <Save className="mr-2 h-4 w-4" /> Save Setup
                        </Button>
                        </DialogTrigger>
                        <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Save Interview Setup</DialogTitle>
                            <DialogDescription>Enter a title for this interview configuration.</DialogDescription>
                        </DialogHeader>
                        <Input
                            placeholder="e.g., FAANG PM L5 Prep, Behavioral Practice"
                            value={newSetupTitle}
                            onChange={(e) => setNewSetupTitle(e.target.value)}
                            className="my-4"
                        />
                        <DialogFooter>
                            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveCurrentSetup} disabled={isSavingSetup || !newSetupTitle.trim()}>
                            {isSavingSetup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                            </Button>
                        </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                 <FormField
                    control={form.control}
                    name="selectedThemeId"
                    render={({ field }) => (
                        <FormItem className="flex-grow">
                        <FormLabel className="flex items-center">
                            <PackageSearch className="mr-2 h-5 w-5 text-primary" />
                            Interview Theme
                        </FormLabel>
                        <Select onValueChange={handleThemeChange} value={field.value || "custom"}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a theme or configure manually" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            <SelectItem value="custom">
                                Custom Configuration
                            </SelectItem>
                            {THEMED_INTERVIEW_PACKS.map((pack) => (
                                <SelectItem key={pack.id} value={pack.id} title={pack.description}>
                                {pack.label}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormDescription>
                            Select a theme or configure manually below.
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                
                <FormField
                  control={form.control}
                  name="interviewType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Brain className="mr-2 h-5 w-5 text-primary" />
                        Interview Type
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an interview type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INTERVIEW_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center">
                                {getIconForType(type.value)}
                                {type.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose the category for your mock interview.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interviewStyle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <MessagesSquare className="mr-2 h-5 w-5 text-primary" />
                        Interview Style
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an interview style" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INTERVIEW_STYLES.map((style) => (
                            <SelectItem key={style.value} value={style.value}>
                              <div className="flex items-center">
                                {getIconForStyle(style.value)}
                                {style.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose question delivery: Q&A, multi-turn case study, or take-home.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="faangLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Star className="mr-2 h-5 w-5 text-primary" />
                        Target FAANG Level
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a FAANG level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FAANG_LEVELS.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the difficulty level for your interview.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="interviewerPersona"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Users2 className="mr-2 h-5 w-5 text-primary" />
                        Interviewer Persona (Optional)
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || INTERVIEWER_PERSONAS[0].value} >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an interviewer persona" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INTERVIEWER_PERSONAS.map((persona) => (
                            <SelectItem key={persona.value} value={persona.value}>
                              {persona.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose the style of the AI interviewer.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Contextual Details (Optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="targetCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Building className="mr-2 h-5 w-5 text-primary" />
                        Target Company
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Amazon, Google, Meta"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Specifying a company (especially 'Amazon') can help tailor questions to their values (e.g., Leadership Principles).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Briefcase className="mr-2 h-5 w-5 text-primary" />
                        Job Title
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Senior Product Manager, Software Engineer II"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Helps tailor questions to the specific role and its expected technical depth.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interviewFocus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <SearchCheck className="mr-2 h-5 w-5 text-primary" />
                        Specific Focus
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 'handling high-traffic events', 'customer retention strategies'"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Provide a specific sub-topic or theme to further tailor the interview.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {availableSkills.length > 0 && form.getValues("selectedThemeId") === "custom" && (
                  <FormField
                    control={form.control}
                    name="targetedSkills"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          <Target className="mr-2 h-5 w-5 text-primary" />
                          Targeted Skills
                        </FormLabel>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 p-3 border rounded-md bg-background">
                          {availableSkills.map((skill) => (
                            <FormField
                              key={skill.value}
                              control={form.control}
                              name="targetedSkills"
                              render={({ field: skillField }) => {
                                return (
                                  <FormItem
                                    key={skill.value}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={skillField.value?.includes(skill.value)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? skillField.onChange([...(skillField.value || []), skill.value])
                                            : skillField.onChange(
                                                (skillField.value || []).filter(
                                                  (value) => value !== skill.value
                                                )
                                              );
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal">
                                      {skill.label}
                                    </FormLabel>
                                  </FormItem>
                                );
                              }}
                            />
                          ))}
                        </div>
                        <FormDescription>
                          Select specific skills to focus on within the chosen interview type.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Resume & Job Description (Optional)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <FormField
                    control={form.control}
                    name="resume"
                    render={({ field }) => (
                        <FormItem>
                        <div className="flex items-center justify-between mb-1">
                            <FormLabel className="flex items-center">
                            <UserCircle className="mr-2 h-5 w-5 text-primary" />
                            Your Resume
                            </FormLabel>
                            <div className="flex items-center space-x-1">
                              <Button
                                  type="button"
                                  variant="outline"
                                  size="xs" 
                                  onClick={() => fileInputRef.current?.click()}
                                  className="text-xs"
                              >
                                  <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                                  Upload .txt
                              </Button>
                              <Dialog open={isSaveResumeDialogOpen} onOpenChange={setIsSaveResumeDialogOpen}>
                                  <DialogTrigger asChild>
                                  <Button type="button" variant="outline" size="xs" className="text-xs" disabled={!user || !currentResumeContent?.trim()} onClick={() => setNewResumeTitle("")}>
                                      <Save className="mr-1.5 h-3.5 w-3.5" /> Save
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
                                  <Button type="button" variant="outline" size="xs" className="text-xs" disabled={!user} onClick={handleOpenLoadResumeDialog}>
                                      <List className="mr-1.5 h-3.5 w-3.5" /> Load
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
                        <FormControl>
                            <Textarea
                            placeholder="Paste your resume content here or upload a .txt file..."
                            className="resize-y min-h-[120px]"
                            {...field}
                            onBlur={handleResumeAnalysis}
                            />
                        </FormControl>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".txt"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <div className="flex justify-between items-center">
                            <FormDescription>
                            Paste resume or upload .txt. Helps AI ask relevant questions.
                            {!user && <span className="text-xs text-amber-600 ml-2">(Login to save/load resumes)</span>}
                            </FormDescription>
                            {selectedFileName && (
                            <span className="text-xs text-muted-foreground">
                                File: {selectedFileName}
                            </span>
                            )}
                        </div>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                    {(isSummarizingResume || resumeSummaryError || resumeSummary) && (
                    <div className="space-y-2">
                        {isSummarizingResume && (
                        <Alert>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <AlertTitle>Analyzing Resume...</AlertTitle>
                            <AlertDescription>
                            Please wait while we extract key points from your resume.
                            </AlertDescription>
                        </Alert>
                        )}
                        {resumeSummaryError && !isSummarizingResume && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-5 w-5" />
                            <AlertTitle>Resume Analysis Error</AlertTitle>
                            <AlertDescription>
                            {resumeSummaryError}
                            <Button variant="link" size="sm" onClick={handleResumeAnalysis} className="p-0 h-auto ml-1">Try again</Button>
                            </AlertDescription>
                        </Alert>
                        )}
                        {resumeSummary && !isSummarizingResume && !resumeSummaryError && (
                        <Alert variant="default" className="bg-accent/10 border-accent/30">
                            <Lightbulb className="h-5 w-5 text-accent" />
                            <AlertTitle className="text-accent">Resume Highlights</AlertTitle>
                            <AlertDescription className="whitespace-pre-wrap text-foreground/80">
                            {resumeSummary}
                            </AlertDescription>
                        </Alert>
                        )}
                    </div>
                    )}

                    <FormField
                    control={form.control}
                    name="jobDescription"
                    render={({ field }) => (
                        <FormItem>
                        <div className="flex items-center justify-between mb-1">
                            <FormLabel className="flex items-center">
                            <FileText className="mr-2 h-5 w-5 text-primary" />
                            Job Description
                            </FormLabel>
                            <div className="flex items-center space-x-1">
                              <Dialog open={isSaveJobDescriptionDialogOpen} onOpenChange={setIsSaveJobDescriptionDialogOpen}>
                                  <DialogTrigger asChild>
                                  <Button type="button" variant="outline" size="xs" className="text-xs" disabled={!user || !currentJobDescriptionContent?.trim()} onClick={() => setNewJobDescriptionTitle("")}>
                                      <Save className="mr-1.5 h-3.5 w-3.5" /> Save
                                  </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                  <DialogHeader><DialogTitle>Save Job Description</DialogTitle><DialogDescription>Enter a title for this JD.</DialogDescription></DialogHeader>
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
                                  <Button type="button" variant="outline" size="xs" className="text-xs" disabled={!user} onClick={handleOpenLoadJobDescriptionDialog}>
                                      <List className="mr-1.5 h-3.5 w-3.5" /> Load
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
                        <FormControl>
                            <Textarea
                            placeholder="Paste the job description here to tailor questions..."
                            className="resize-y min-h-[120px]"
                            {...field}
                            />
                        </FormControl>
                        <FormDescription>
                            Providing a job description helps personalize the interview questions.
                            {!user && <span className="text-xs text-amber-600 ml-2">(Login to save/load JDs)</span>}
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </CardContent>
            </Card>


            <Button type="submit" className="w-full text-lg py-6" disabled={isSubmitting || isSummarizingResume || authLoading}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Starting Interview...
                </>
              ) : (
                "Start Interview"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
    </>
  );
}

