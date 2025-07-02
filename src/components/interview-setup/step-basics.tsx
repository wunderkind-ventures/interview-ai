"use client";

import { UseFormReturn } from "react-hook-form";
import { 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";
import { 
  INTERVIEW_TYPES, 
  INTERVIEW_STYLES, 
  FAANG_LEVELS,
  INTERVIEWER_PERSONAS 
} from "@/lib/constants";
import type { InterviewSetupData } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StepBasicsProps {
  form: UseFormReturn<InterviewSetupData>;
}

export default function StepBasics({ form }: StepBasicsProps) {
  return (
    <div className="space-y-6">
      {/* Interview Type */}
      <FormField
        control={form.control}
        name="interviewType"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-semibold">Interview Type</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select interview type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {INTERVIEW_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="py-3">
                    <div className="flex items-center gap-3">
                      <type.icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Interview Style */}
      <FormField
        control={form.control}
        name="interviewStyle"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-2">
              <FormLabel className="text-base font-semibold">Interview Style</FormLabel>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Choose how the interviewer should conduct the session</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select interview style" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {INTERVIEW_STYLES.map((style) => (
                  <SelectItem key={style.value} value={style.value} className="py-3">
                    <div className="flex items-center gap-3">
                      <style.icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{style.label}</div>
                        <div className="text-xs text-muted-foreground">{style.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* FAANG Level */}
      <FormField
        control={form.control}
        name="faangLevel"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-2">
              <FormLabel className="text-base font-semibold">Target Level</FormLabel>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>FAANG levels help calibrate the difficulty and expectations of the interview</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select your target level" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {FAANG_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value} className="py-3">
                    <div className="flex items-center gap-3">
                      <level.icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{level.label}</div>
                        <div className="text-xs text-muted-foreground">{level.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Interviewer Persona (Optional) */}
      <FormField
        control={form.control}
        name="interviewerPersona"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-2">
              <FormLabel className="text-base font-semibold">
                Interviewer Persona 
                <span className="text-sm font-normal text-muted-foreground ml-2">(Optional)</span>
              </FormLabel>
            </div>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select interviewer persona" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="">Default</SelectItem>
                {INTERVIEWER_PERSONAS.map((persona) => (
                  <SelectItem key={persona.value} value={persona.value} className="py-3">
                    <div>
                      <div className="font-medium">{persona.label}</div>
                      <div className="text-xs text-muted-foreground">{persona.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Info Card */}
      <Card className="bg-muted/50 border-muted">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Quick Tips</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Choose the interview type that matches your target role</li>
                <li>• Start with "friendly" style if you're new to mock interviews</li>
                <li>• Select the level you're targeting, not your current level</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}