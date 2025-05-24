
"use client";

import React, { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { getFirestore, doc, setDoc, serverTimestamp, collection } from "firebase/firestore";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle as UiCardTitle } from "@/components/ui/card"; // Renamed CardTitle to UiCardTitle
import { CalendarIcon, Loader2, Save, Sparkles, AlertTriangle, Lightbulb, CheckSquare, X } from "lucide-react";
import { format, parseISO } from 'date-fns';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Achievement } from "@/lib/types";
import { getAchievementComponentGuidance } from "@/ai/flows/get-achievement-component-guidance";
import type { GetAchievementComponentGuidanceOutput, GetAchievementComponentGuidanceInput } from "@/ai/flows/get-achievement-component-guidance";
import { Badge } from "./ui/badge";
import { Alert, AlertTitle, AlertDescription as UiAlertDescription } from "./ui/alert"; // Renamed AlertDescription


const achievementFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(150, "Title must be 150 characters or less."),
  situation: z.string().min(10, "Situation must be at least 10 characters.").max(1000, "Situation must be 1000 characters or less."),
  task: z.string().min(10, "Task must be at least 10 characters.").max(1000, "Task must be 1000 characters or less."),
  action: z.string().min(10, "Action must be at least 10 characters.").max(2000, "Action must be 2000 characters or less."),
  result: z.string().min(10, "Result must be at least 10 characters.").max(1000, "Result must be 1000 characters or less."),
  skillsDemonstrated: z.string().optional().describe("Comma-separated list of skills."),
  quantifiableImpact: z.string().optional(),
  dateAchieved: z.date().optional(),
});

type AchievementFormValues = z.infer<typeof achievementFormSchema>;

interface AddAchievementFormProps {
  userId: string;
  existingAchievement?: Achievement | null;
  onFormSubmit: () => void;
}

type StarComponentType = 'situation' | 'task' | 'action' | 'result' | 'quantifiableImpact';


export function AddAchievementForm({ userId, existingAchievement, onFormSubmit }: AddAchievementFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeHelpComponent, setActiveHelpComponent] = useState<StarComponentType | null>(null);
  const [aiGuidance, setAiGuidance] = useState<GetAchievementComponentGuidanceOutput | null>(null);
  const [isFetchingAiGuidance, setIsFetchingAiGuidance] = useState(false);
  const [aiGuidanceError, setAiGuidanceError] = useState<string | null>(null);
  const aiAssistancePanelRef = useRef<HTMLDivElement>(null);


  const defaultValues: Partial<AchievementFormValues> = existingAchievement
    ? {
        title: existingAchievement.title,
        situation: existingAchievement.situation,
        task: existingAchievement.task,
        action: existingAchievement.action,
        result: existingAchievement.result,
        skillsDemonstrated: existingAchievement.skillsDemonstrated?.join(', ') || '',
        quantifiableImpact: existingAchievement.quantifiableImpact || '',
        dateAchieved: existingAchievement.dateAchieved ? parseISO(existingAchievement.dateAchieved as unknown as string) : undefined,
      }
    : {
        title: "",
        situation: "",
        task: "",
        action: "",
        result: "",
        skillsDemonstrated: "",
        quantifiableImpact: "",
      };

  const form = useForm<AchievementFormValues>({
    resolver: zodResolver(achievementFormSchema),
    defaultValues,
    mode: "onChange",
  });

  useEffect(() => {
    if (activeHelpComponent && aiGuidance && !isFetchingAiGuidance && aiAssistancePanelRef.current) {
      aiAssistancePanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [aiGuidance, activeHelpComponent, isFetchingAiGuidance]);

  const handleAiAssist = async (component: StarComponentType) => {
    setActiveHelpComponent(component);
    setIsFetchingAiGuidance(true);
    setAiGuidance(null);
    setAiGuidanceError(null);

    const currentFormValues = form.getValues();
    const input: GetAchievementComponentGuidanceInput = {
      achievementTitle: currentFormValues.title,
      componentToElaborate: component,
      existingComponents: {
        title: currentFormValues.title,
        situation: currentFormValues.situation,
        task: currentFormValues.task,
        action: currentFormValues.action,
        result: currentFormValues.result,
        quantifiableImpact: currentFormValues.quantifiableImpact,
      },
    };

    try {
      const guidance = await getAchievementComponentGuidance(input);
      setAiGuidance(guidance);
    } catch (error) {
      console.error("Error fetching AI guidance:", error);
      const message = error instanceof Error ? error.message : "Could not fetch AI guidance.";
      setAiGuidanceError(message);
      toast({ title: "AI Assist Error", description: message, variant: "destructive" });
    } finally {
      setIsFetchingAiGuidance(false);
    }
  };

  const closeAiAssistancePanel = () => {
    setActiveHelpComponent(null);
    setAiGuidance(null);
    setAiGuidanceError(null);
  };

  const renderAiAssistButton = (component: StarComponentType) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => handleAiAssist(component)}
      className="ml-2 text-xs text-primary hover:bg-primary/10 px-1 py-0.5 h-auto"
      aria-label={`Get AI assistance for ${component}`}
    >
      <Sparkles className="h-3.5 w-3.5 mr-1" /> AI Assist
    </Button>
  );


  async function onSubmit(data: AchievementFormValues) {
    setIsSubmitting(true);
    closeAiAssistancePanel();
    const db = getFirestore();
    const achievementId = existingAchievement?.id || doc(collection(db, `users/${userId}/achievements`)).id;

    const achievementData: Omit<Achievement, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: any, updatedAt: any } = {
      title: data.title,
      situation: data.situation,
      task: data.task,
      action: data.action,
      result: data.result,
      skillsDemonstrated: data.skillsDemonstrated?.split(',').map(skill => skill.trim()).filter(skill => skill) || [],
      quantifiableImpact: data.quantifiableImpact || "",
      dateAchieved: data.dateAchieved ? data.dateAchieved.toISOString() : null,
      updatedAt: serverTimestamp(),
    };

    if (!existingAchievement) {
      achievementData.createdAt = serverTimestamp();
    }

    try {
      await setDoc(doc(db, `users/${userId}/achievements`, achievementId), achievementData, { merge: true });
      toast({
        title: existingAchievement ? "Achievement Updated" : "Achievement Added",
        description: `Your achievement "${data.title}" has been saved.`,
      });
      onFormSubmit();
    } catch (error) {
      console.error("Error saving achievement: ", error);
      toast({
        title: "Error Saving Achievement",
        description: "Could not save your achievement. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const starLabelClass = "font-semibold text-foreground/90 text-base";

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-2 max-h-[70vh] overflow-y-auto pr-3">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Achievement Title</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Launched New Feature X" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dateAchieved"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date Achieved (Optional)</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <p className="text-sm font-medium text-primary border-t pt-4">STAR Method Components:</p>

          <FormField
            control={form.control}
            name="situation"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className={starLabelClass}>Situation</FormLabel>
                  {renderAiAssistButton('situation')}
                </div>
                <FormControl>
                  <Textarea
                    placeholder="Describe the context or background."
                    className="resize-none min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="task"
            render={({ field }) => (
              <FormItem>
                 <div className="flex items-center justify-between">
                  <FormLabel className={starLabelClass}>Task</FormLabel>
                  {renderAiAssistButton('task')}
                </div>
                <FormControl>
                  <Textarea
                    placeholder="What was your responsibility or the goal?"
                    className="resize-none min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="action"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className={starLabelClass}>Action</FormLabel>
                  {renderAiAssistButton('action')}
                </div>
                <FormControl>
                  <Textarea
                    placeholder="What specific steps did you take?"
                    className="resize-none min-h-[120px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="result"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className={starLabelClass}>Result</FormLabel>
                  {renderAiAssistButton('result')}
                </div>
                <FormControl>
                  <Textarea
                    placeholder="What was the outcome of your actions?"
                    className="resize-none min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quantifiableImpact"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className={starLabelClass}>Quantifiable Impact (Optional)</FormLabel>
                  {renderAiAssistButton('quantifiableImpact')}
                </div>
                <FormControl>
                  <Input placeholder="e.g., Increased revenue by 15%, Reduced latency by 200ms" {...field} />
                </FormControl>
                <FormDescription>Highlight any measurable outcomes.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="skillsDemonstrated"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Skills Demonstrated (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Project Management, Python, Team Leadership" {...field} />
                </FormControl>
                <FormDescription>Comma-separated list of skills.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {activeHelpComponent && (aiGuidance || isFetchingAiGuidance || aiGuidanceError) && (
            <Card ref={aiAssistancePanelRef} className="mt-6 mb-4 border-primary/50 shadow-md">
              <CardHeader className="py-3 px-4 bg-primary/10">
                <div className="flex items-center justify-between">
                    <UiCardTitle className="text-base font-semibold text-primary flex items-center">
                        <Sparkles className="h-5 w-5 mr-2" />
                        AI Assistance for {activeHelpComponent.charAt(0).toUpperCase() + activeHelpComponent.slice(1)}
                    </UiCardTitle>
                    <Button variant="ghost" size="icon" onClick={closeAiAssistancePanel} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close AI Assistance</span>
                    </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-sm">
                {isFetchingAiGuidance && (
                  <div className="flex items-center text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching AI guidance...
                  </div>
                )}
                {aiGuidanceError && !isFetchingAiGuidance && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <UiAlertDescription>{aiGuidanceError}</UiAlertDescription>
                  </Alert>
                )}
                {aiGuidance && !isFetchingAiGuidance && (
                  <div className="space-y-3">
                    {aiGuidance.guidingQuestions && aiGuidance.guidingQuestions.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-muted-foreground mb-1 flex items-center"><Lightbulb className="h-4 w-4 mr-1.5 text-yellow-500" />Guiding Questions:</h5>
                        <ul className="list-disc space-y-0.5 pl-5">
                          {aiGuidance.guidingQuestions.map((q, i) => <li key={`gq-${i}`}>{q}</li>)}
                        </ul>
                      </div>
                    )}
                    {aiGuidance.examplePhrases && aiGuidance.examplePhrases.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-muted-foreground mb-1 flex items-center"><Sparkles className="h-4 w-4 mr-1.5 text-indigo-500" />Example Phrases:</h5>
                        <ul className="list-disc space-y-0.5 pl-5">
                          {aiGuidance.examplePhrases.map((p, i) => <li key={`ep-${i}`}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    {aiGuidance.suggestedPointsToConsider && aiGuidance.suggestedPointsToConsider.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-muted-foreground mb-1.5 flex items-center"><CheckSquare className="h-4 w-4 mr-1.5 text-green-500" />Suggested Points to Consider:</h5>
                         <div className="flex flex-wrap gap-1.5">
                          {aiGuidance.suggestedPointsToConsider.map((s, i) => (
                            <Badge key={`sp-${i}`} variant="secondary" className="text-xs font-normal">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}


          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Achievement
              </>
            )}
          </Button>
        </form>
      </Form>
    </>
  );
}
