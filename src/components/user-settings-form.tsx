
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Save, AlertTriangle, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AppSecrets } from "@/lib/types";

export default function UserSettingsForm() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (user) {
        setIsLoading(true);
        try {
          const db = getFirestore();
          const settingsDocRef = doc(db, "users", user.uid, "userSettings", "appSecrets");
          const docSnap = await getDoc(settingsDocRef);
          if (docSnap.exists()) {
            const settings = docSnap.data() as AppSecrets;
            setGeminiApiKey(settings.geminiApiKey || "");
          }
        } catch (error) {
          console.error("Error fetching user settings:", error);
          toast({
            title: "Error Loading Settings",
            description: "Could not load your saved settings. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      } else if (!authLoading) {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [user, authLoading, toast]);

  const handleSaveSettings = async () => {
    if (!user) {
      toast({
        title: "Not Authenticated",
        description: "You must be logged in to save settings.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      const db = getFirestore();
      const settingsDocRef = doc(db, "users", user.uid, "userSettings", "appSecrets");
      const settingsData: AppSecrets = {
        geminiApiKey: geminiApiKey.trim() || undefined, // Store undefined if empty to remove field
      };
      await setDoc(settingsDocRef, settingsData, { merge: true });
      toast({
        title: "Settings Saved",
        description: "Your settings have been successfully updated.",
      });
    } catch (error) {
      console.error("Error saving user settings:", error);
      toast({
        title: "Error Saving Settings",
        description: "Could not save your settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-orange-400 mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground">Please Log In</h2>
        <p className="text-muted-foreground">
          You need to be logged in to manage your settings.
        </p>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl text-primary">
          <KeyRound className="mr-2 h-6 w-6" /> API Key Management
        </CardTitle>
        <CardDescription>
          Optionally, provide your own Gemini API key to use your personal quota for AI features.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="default" className="bg-amber-50 border-amber-300 text-amber-700">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertTitle className="font-semibold">Security & Usage Notice</AlertTitle>
          <AlertDescription className="text-xs">
            This feature allows you to use your personal Google AI Gemini API key.
            The key is stored in your user-specific data in Firestore. While we take precautions,
            managing the security and quota of this key is your responsibility.
            This feature is intended for advanced users who understand the implications.
            If no key is provided, the application will use its default configured AI services.
            <br />
            **Note:** This is a prototype feature. For production, more robust secret management would be required.
          </AlertDescription>
        </Alert>
        <div className="space-y-2">
          <Label htmlFor="geminiApiKey">Your Google AI Gemini API Key</Label>
          <Input
            id="geminiApiKey"
            type="password"
            placeholder="Enter your Gemini API Key (e.g., AIza...)"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to use the app's default AI configuration.
            You can obtain a key from Google AI Studio.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save API Key
        </Button>
      </CardFooter>
    </Card>
  );
}
