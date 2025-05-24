
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Brain, FileText, UserCircle, Star, Workflow, Users, Loader2, MessagesSquare, ListChecks, Lightbulb, AlertTriangle, Target, Building, Layers, Briefcase, SearchCheck, PackageSearch, BrainCircuit, Code2, UploadCloud, Save, List, AlertCircle, Trash2 } from "lucide-react";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc, deleteDoc, orderBy } from "firebase/firestore";
import { useAuth } from '@/contexts/auth-context';

import { Button } from "@/components/ui/button";
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


import { INTERVIEW_TYPES, FAANG_LEVELS, LOCAL_STORAGE_KEYS, type InterviewType, type FaangLevel, INTERVIEW_STYLES, type InterviewStyle, SKILLS_BY_INTERVIEW_TYPE, THEMED_INTERVIEW_PACKS, type Skill } from "@/lib/constants";
import type { InterviewSetupData, ThemedInterviewPack, ThemedInterviewPackConfig, SavedResume } from "@/lib/types";
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
    },
  });

  const watchedInterviewType = form.watch("interviewType");
  const currentResumeContent = form.watch("resume");

  const availableSkills: Skill[] = useMemo(() => {
    return SKILLS_BY_INTERVIEW_TYPE[watchedInterviewType] || [];
  }, [watchedInterviewType]);

  useEffect(() => {
    if (form.getValues("selectedThemeId") === "custom" && availableSkills.length > 0) {
      // When switching to custom from a theme, or when available skills change for custom,
      // filter current targetedSkills to ensure they are valid for the new type.
      const currentTargetedSkills = form.getValues("targetedSkills") || [];
      const validCurrentTargetedSkills = currentTargetedSkills.filter(skillVal =>
        availableSkills.some(s => s.value === skillVal)
      );
      if (currentTargetedSkills.length !== validCurrentTargetedSkills.length) {
        form.setValue("targetedSkills", validCurrentTargetedSkills);
      }
    } else if (form.getValues("selectedThemeId") !== "custom") {
        // Theme is selected, skills are handled by handleThemeChange
    } else { // Custom config and no available skills (e.g. initial load)
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
       // When switching to custom, retain current values but ensure skills are valid
      const currentTargetedSkills = form.getValues("targetedSkills") || [];
      const validCurrentTargetedSkills = currentTargetedSkills.filter(skillVal =>
        availableSkills.some(s => s.value === skillVal)
      );
      form.setValue("targetedSkills", validCurrentTargetedSkills);
      return;
    }
    const selectedPack = THEMED_INTERVIEW_PACKS.find(pack => pack.id === themeId);
    if (selectedPack) {
      const { config } = selectedPack;
      const currentResume = form.getValues("resume");
      const newFormValues: Partial<z.infer<typeof formSchema>> = {
        interviewType: config.interviewType || INTERVIEW_TYPES[0].value,
        interviewStyle: config.interviewStyle || INTERVIEW_STYLES[0].value,
        faangLevel: config.faangLevel || FAANG_LEVELS[1].value,
        jobTitle: config.jobTitle || "",
        jobDescription: config.jobDescription || "",
        targetedSkills: [],
        targetCompany: config.targetCompany || "",
        interviewFocus: config.interviewFocus || "",
        resume: currentResume,
        selectedThemeId: themeId,
      };
      form.reset(newFormValues); // Reset with theme, will trigger watchedInterviewType change
      
      // Skills need to be set after form.reset potentially changes interviewType
      // and thus availableSkills.
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
            <FormField
              control={form.control}
              name="selectedThemeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-lg">
                    <PackageSearch className="mr-2 h-5 w-5 text-primary" />
                    Interview Theme (Optional)
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
                    Choosing a theme will pre-fill settings below. You can still customize them.
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
                  <FormLabel className="flex items-center text-lg">
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

            {availableSkills.length > 0 && (
              <FormField
                control={form.control}
                name="targetedSkills"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center text-lg">
                      <Target className="mr-2 h-5 w-5 text-primary" />
                      Targeted Skills (Optional)
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

            <FormField
              control={form.control}
              name="interviewStyle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-lg">
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
                  <FormLabel className="flex items-center text-lg">
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
              name="targetCompany"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-lg">
                    <Building className="mr-2 h-5 w-5 text-primary" />
                    Target Company (Optional)
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
                  <FormLabel className="flex items-center text-lg">
                    <Briefcase className="mr-2 h-5 w-5 text-primary" />
                    Job Title (Optional)
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
              name="jobDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-lg">
                    <FileText className="mr-2 h-5 w-5 text-primary" />
                    Job Description (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste the job description here to tailor questions..."
                      className="resize-y min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Providing a job description helps personalize the interview questions.
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
                  <FormLabel className="flex items-center text-lg">
                    <SearchCheck className="mr-2 h-5 w-5 text-primary" />
                    Specific Focus (Optional)
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

            <FormField
              control={form.control}
              name="resume"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between mb-1">
                    <FormLabel className="flex items-center text-lg">
                      <UserCircle className="mr-2 h-5 w-5 text-primary" />
                      Your Resume (Optional)
                    </FormLabel>
                    <div className="flex items-center space-x-2">
                       <Dialog open={isSaveResumeDialogOpen} onOpenChange={setIsSaveResumeDialogOpen}>
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline" size="sm" disabled={!user || !currentResumeContent?.trim()} onClick={() => setNewResumeTitle("")}>
                            <Save className="mr-2 h-4 w-4" /> Save this Resume
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Save Resume</DialogTitle>
                            <DialogDescription>Enter a title for this resume to save it for later use.</DialogDescription>
                          </DialogHeader>
                          <Input
                            placeholder="e.g., My FAANG Resume, Data Science Resume v3"
                            value={newResumeTitle}
                            onChange={(e) => setNewResumeTitle(e.target.value)}
                            className="my-4"
                          />
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
                            <List className="mr-2 h-4 w-4" /> Load Saved
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Load Saved Resume</DialogTitle>
                                <DialogDescription>Select a resume to load into the form.</DialogDescription>
                            </DialogHeader>
                            {isLoadingResumes ? (
                                <div className="flex justify-center items-center h-32">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : savedResumes.length > 0 ? (
                                <ScrollArea className="h-[200px] my-4">
                                    <div className="space-y-2 pr-2">
                                    {savedResumes.map((res) => (
                                        <Card key={res.id} className="p-3 flex justify-between items-center hover:bg-secondary/50 transition-colors">
                                            <div>
                                                <p className="font-medium text-sm">{res.title}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Saved: {res.createdAt?.toDate ? res.createdAt.toDate().toLocaleDateString() : 'Date N/A'}
                                                </p>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <Button variant="ghost" size="sm" onClick={() => handleLoadResume(res)}>Load</Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive">
                                                          <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Resume?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Are you sure you want to delete "{res.title}"? This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteResume(res.id!)} className={Button({variant:"destructive"}).props.className}>
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
                                <p className="text-sm text-muted-foreground text-center py-4">No saved resumes found.</p>
                            )}
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                            </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="hidden sm:inline-flex"
                      >
                        <UploadCloud className="mr-2 h-4 w-4" />
                        Upload .txt
                      </Button>
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
                      Paste resume or <Button type="button" variant="link" size="sm" className="p-0 h-auto sm:hidden" onClick={() => fileInputRef.current?.click()}>upload .txt</Button>. Helps AI ask relevant questions.
                      {!user && <span className="text-xs text-amber-600 ml-2">(Login to save/load resumes)</span>}
                    </FormDescription>
                    {selectedFileName && (
                      <span className="text-xs text-muted-foreground">
                        Selected: {selectedFileName}
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
