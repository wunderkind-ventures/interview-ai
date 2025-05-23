
"use client";

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
import { CalendarIcon, Loader2, Save } from "lucide-react";
import { format, parseISO } from 'date-fns';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Achievement } from "@/lib/types";

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

export function AddAchievementForm({ userId, existingAchievement, onFormSubmit }: AddAchievementFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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

  async function onSubmit(data: AchievementFormValues) {
    setIsSubmitting(true);
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

  return (
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

        <p className="text-sm font-medium text-primary">STAR Method Components:</p>
        <FormField
          control={form.control}
          name="situation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Situation</FormLabel>
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
              <FormLabel>Task</FormLabel>
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
              <FormLabel>Action</FormLabel>
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
              <FormLabel>Result</FormLabel>
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
              <FormLabel>Quantifiable Impact (Optional)</FormLabel>
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
  );
}

