"use client";

import { UseFormReturn } from "react-hook-form";
import { useState } from "react";
import { 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import type { InterviewSetupData } from "@/lib/types";

interface StepDocumentsProps {
  form: UseFormReturn<InterviewSetupData>;
}

export default function StepDocuments({ form }: StepDocumentsProps) {
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  
  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingResume(true);
    setResumeFileName(file.name);

    // Simulate file upload - in real app, this would upload to storage
    setTimeout(() => {
      // For now, we'll read the file as text if it's a text file
      if (file.type === "text/plain" || file.name.endsWith('.md')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          form.setValue("resumeText", e.target?.result as string);
        };
        reader.readAsText(file);
      }
      setIsUploadingResume(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Resume Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resume
          </CardTitle>
          <CardDescription>
            Upload your resume or paste it below. We'll analyze it to provide more relevant questions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div className="flex items-center gap-4">
            <input
              type="file"
              id="resume-upload"
              className="sr-only"
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={handleResumeUpload}
              disabled={isUploadingResume}
            />
            <label
              htmlFor="resume-upload"
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all
                ${isUploadingResume 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:bg-muted'
                }
              `}
            >
              {isUploadingResume ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">
                {isUploadingResume ? "Uploading..." : "Upload File"}
              </span>
            </label>
            
            {resumeFileName && !isUploadingResume && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {resumeFileName}
              </div>
            )}
          </div>

          {/* Text Input */}
          <FormField
            control={form.control}
            name="resumeText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Or paste your resume here</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Paste your resume content..."
                    className="min-h-[200px] font-mono text-sm"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Plain text or markdown format works best
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Job Description */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Job Description
          </CardTitle>
          <CardDescription>
            Paste the job description to get questions tailored to the specific role requirements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormField
            control={form.control}
            name="jobDescription"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Paste the job description here..."
                    className="min-h-[150px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Include key responsibilities, requirements, and qualifications
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Privacy:</strong> Your resume and job description are processed securely and never stored permanently. 
          They're only used to generate relevant interview questions for this session.
        </AlertDescription>
      </Alert>

      {/* Tips Card */}
      <Card className="bg-muted/50 border-muted">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">📝 Document Tips</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Include quantifiable achievements in your resume</li>
            <li>• Highlight technologies and skills relevant to the role</li>
            <li>• The job description helps us ask role-specific questions</li>
            <li>• Both fields are optional but highly recommended</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}