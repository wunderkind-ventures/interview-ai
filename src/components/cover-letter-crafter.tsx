
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Sparkles, FileText, ClipboardCopy, AlertTriangle, Building, User, Edit3, MailPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateCoverLetter, type GenerateCoverLetterInput, type GenerateCoverLetterOutput } from '@/ai/flows/generate-cover-letter';

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
                Please log in to use the Cover Letter Crafter.
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
            <label htmlFor="jobDescriptionText" className="block text-sm font-medium text-foreground mb-1">Job Description *</label>
            <Textarea
              id="jobDescriptionText"
              placeholder="Paste the full job description here..."
              value={jobDescriptionText}
              onChange={(e) => setJobDescriptionText(e.target.value)}
              className="min-h-[150px] text-sm"
              rows={8}
            />
             <p className="text-xs text-muted-foreground mt-1">Min. 50 characters.</p>
          </div>

          <div>
            <label htmlFor="resumeText" className="block text-sm font-medium text-foreground mb-1">Your Resume *</label>
            <Textarea
              id="resumeText"
              placeholder="Paste your full resume content here..."
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="min-h-[200px] text-sm"
              rows={10}
            />
            <p className="text-xs text-muted-foreground mt-1">Min. 100 characters.</p>
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

    