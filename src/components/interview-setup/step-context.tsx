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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Briefcase, Target, X } from "lucide-react";
import { SKILLS_BY_INTERVIEW_TYPE, ROLE_TYPES } from "@/lib/constants";
import type { InterviewSetupData } from "@/lib/types";
import { useState } from "react";

interface StepContextProps {
  form: UseFormReturn<InterviewSetupData>;
}

export default function StepContext({ form }: StepContextProps) {
  const [customSkill, setCustomSkill] = useState("");
  const interviewType = form.watch("interviewType");
  const selectedSkills = form.watch("skills") || [];
  
  const suggestedSkills = interviewType ? SKILLS_BY_INTERVIEW_TYPE[interviewType] || [] : [];

  const handleAddCustomSkill = () => {
    if (customSkill.trim() && !selectedSkills.includes(customSkill.trim())) {
      form.setValue("skills", [...selectedSkills, customSkill.trim()]);
      setCustomSkill("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    form.setValue("skills", selectedSkills.filter(skill => skill !== skillToRemove));
  };

  return (
    <div className="space-y-6">
      {/* Target Company */}
      <FormField
        control={form.control}
        name="targetCompany"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Target Company
            </FormLabel>
            <FormControl>
              <Input 
                placeholder="e.g., Google, Meta, Amazon..." 
                className="h-12"
                {...field} 
              />
            </FormControl>
            <FormDescription>
              We'll tailor questions to match this company's interview style
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Job Title */}
      <FormField
        control={form.control}
        name="jobTitle"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-semibold flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Target Role
            </FormLabel>
            <FormControl>
              <Input 
                placeholder="e.g., Senior Software Engineer, Product Manager..." 
                className="h-12"
                {...field} 
              />
            </FormControl>
            <FormDescription>
              Helps us customize questions for your specific role
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Role Type */}
      <FormField
        control={form.control}
        name="roleType"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-semibold">Role Category</FormLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ROLE_TYPES.map((role) => (
                <label
                  key={role.value}
                  className={`
                    flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${field.value === role.value 
                      ? 'border-primary bg-primary/10' 
                      : 'border-muted hover:border-muted-foreground/50'
                    }
                  `}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    value={role.value}
                    checked={field.value === role.value}
                    onChange={() => field.onChange(role.value)}
                  />
                  <role.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{role.label}</span>
                </label>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Skills */}
      <div className="space-y-3">
        <FormLabel className="text-base font-semibold flex items-center gap-2">
          <Target className="h-4 w-4" />
          Relevant Skills
        </FormLabel>
        
        {/* Suggested Skills */}
        {suggestedSkills.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Suggested skills for {interviewType}:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedSkills.map((skill) => (
                <label
                  key={skill.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedSkills.includes(skill.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        form.setValue("skills", [...selectedSkills, skill.value]);
                      } else {
                        handleRemoveSkill(skill.value);
                      }
                    }}
                  />
                  <span className="text-sm">{skill.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Custom Skill Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Add custom skill..."
            value={customSkill}
            onChange={(e) => setCustomSkill(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomSkill();
              }
            }}
            className="flex-1"
          />
          <button
            type="button"
            onClick={handleAddCustomSkill}
            className="px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Add
          </button>
        </div>

        {/* Selected Skills */}
        {selectedSkills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedSkills.map((skill) => (
              <Badge key={skill} variant="secondary" className="gap-1">
                {skill}
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Years of Experience */}
      <FormField
        control={form.control}
        name="yearsOfExperience"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-semibold">Years of Experience</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                placeholder="e.g., 5" 
                className="h-12"
                {...field}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </FormControl>
            <FormDescription>
              Helps calibrate question difficulty and expectations
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Info Card */}
      <Card className="bg-muted/50 border-muted">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Pro tip:</strong> The more context you provide, the better we can tailor 
            your interview experience. All fields are optional but recommended.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}