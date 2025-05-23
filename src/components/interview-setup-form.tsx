
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Brain, FileText, UserCircle, Star, Workflow, Users, Loader2, MessagesSquare, ListChecks, Lightbulb, AlertTriangle, Target, Building, Layers, Briefcase, SearchCheck, PackageSearch, BrainCircuit, Code2, UploadCloud } from "lucide-react";
import React, { useEffect, useState, useRef } from "react";

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
import { INTERVIEW_TYPES, FAANG_LEVELS, LOCAL_STORAGE_KEYS, InterviewType, FaangLevel, INTERVIEW_STYLES, InterviewStyle, SKILLS_BY_INTERVIEW_TYPE, Skill, THEMED_INTERVIEW_PACKS } from "@/lib/constants";
import type { InterviewSetupData, ThemedInterviewPack, ThemedInterviewPackConfig } from "@/lib/types";
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
  selectedThemeId: z.string().optional(), // For tracking selected theme
});

export default function InterviewSetupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [resumeSummary, setResumeSummary] = useState<string | null>(null);
  const [isSummarizingResume, setIsSummarizingResume] = useState(false);
  const [resumeSummaryError, setResumeSummaryError] = useState<string | null>(null);
  const [summarizedForResumeText, setSummarizedForResumeText] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      selectedThemeId: "custom", // Default to custom
    },
  });

  const watchedInterviewType = form.watch("interviewType");
  const availableSkills = watchedInterviewType ? SKILLS_BY_INTERVIEW_TYPE[watchedInterviewType] : [];

  useEffect(() => {
    // Reset targeted skills when interview type changes, unless a theme is actively setting it
    if (form.getValues("selectedThemeId") === "custom") {
      form.setValue("targetedSkills", []);
    }
  }, [watchedInterviewType, form]);

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
        // If there's stored setup, it's considered custom, not a theme override
        form.reset({
          ...parsedSetup,
          selectedThemeId: "custom", 
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
      // Optionally, you could reset to defaults or keep current values
      // For now, let's keep current values to allow tweaking from a theme
      return;
    }
    const selectedPack = THEMED_INTERVIEW_PACKS.find(pack => pack.id === themeId);
    if (selectedPack) {
      const { config } = selectedPack;
      // Reset form with theme config, but preserve resume
      const currentResume = form.getValues("resume");
      const newFormValues: Partial<z.infer<typeof formSchema>> = {
        interviewType: config.interviewType || INTERVIEW_TYPES[0].value,
        interviewStyle: config.interviewStyle || INTERVIEW_STYLES[0].value,
        faangLevel: config.faangLevel || FAANG_LEVELS[1].value,
        jobTitle: config.jobTitle || "",
        jobDescription: config.jobDescription || "",
        targetedSkills: [], // Reset first
        targetCompany: config.targetCompany || "",
        interviewFocus: config.interviewFocus || "",
        resume: currentResume, // Preserve resume, but clear analysis states
        selectedThemeId: themeId,
      };
      form.reset(newFormValues);
      setResumeSummary(null);
      setResumeSummaryError(null);
      setSummarizedForResumeText(currentResume); // Re-set this to trigger re-analysis if resume exists
      setSelectedFileName(null); // Clear selected file name on theme change


      // Set targetedSkills after interviewType is set by reset to ensure availableSkills is up-to-date
      // This timeout allows the watchedInterviewType effect to run and update availableSkills
      setTimeout(() => {
        if (config.interviewType && config.targetedSkills) {
            const validSkillsForType = SKILLS_BY_INTERVIEW_TYPE[config.interviewType];
            const validThemeSkills = config.targetedSkills.filter(skillVal => validSkillsForType.some(s => s.value === skillVal));
            form.setValue("targetedSkills", validThemeSkills);
        } else {
             form.setValue("targetedSkills", []);
        }
      }, 0);
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
      if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
      return;
    }

    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const textContent = e.target?.result as string;
      if (textContent) {
        form.setValue("resume", textContent);
        // Manually trigger resume analysis as if onBlur happened
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
    const { selectedThemeId, ...setupDataValues } = values; // Exclude selectedThemeId
    const setupData: InterviewSetupData = {
        ...setupDataValues,
        targetedSkills: values.targetedSkills || [], // Ensure it's an array
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

  return (
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
                  <Select onValueChange={handleThemeChange} value={field.value} defaultValue="custom">
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
                  <div className="flex items-center justify-between">
                    <FormLabel className="flex items-center text-lg">
                      <UserCircle className="mr-2 h-5 w-5 text-primary" />
                      Your Resume (Optional)
                    </FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className="mr-2 h-4 w-4" />
                      Upload .txt
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="Paste your resume content here or upload a .txt file..."
                      className="resize-y min-h-[120px]"
                      {...field}
                      onBlur={handleResumeAnalysis} // Keep onBlur analysis for pasted text
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
                      Paste resume or upload a .txt file. Helps AI ask relevant questions.
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
            
            <Button type="submit" className="w-full text-lg py-6" disabled={isSubmitting || isSummarizingResume}>
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
  );
}
