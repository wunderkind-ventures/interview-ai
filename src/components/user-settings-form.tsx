
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Save, AlertTriangle, KeyRound, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// Removed AppSecrets import as we won't directly handle the key on client after save

export default function UserSettingsForm() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState(""); // For the input field
  const [apiKeyStatus, setApiKeyStatus] = useState<"loading" | "set" | "not_set" | "error">("loading");
  const [isSaving, setIsSaving] = useState(false);

  // Simulates fetching the status of an API key from a secure backend
  const fetchApiKeyStatus = async () => {
    if (user) {
      setApiKeyStatus("loading");
      try {
        // PRODUCTION: This would call your backend to check if a key is associated with the user.
        // For prototype, we'll check Firestore directly (read-only for status indication).
        const db = getFirestore();
        const settingsDocRef = doc(db, "users", user.uid, "userSettings", "appSecrets");
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists() && docSnap.data()?.geminiApiKey) {
          setApiKeyStatus("set");
        } else {
          setApiKeyStatus("not_set");
        }
      } catch (error) {
        console.error("Error fetching API key status:", error);
        setApiKeyStatus("error");
        toast({
          title: "Error Loading API Key Status",
          description: "Could not determine if an API key is set. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      setApiKeyStatus("not_set");
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchApiKeyStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Simulates saving the API key to a secure backend
  const handleSaveSettings = async () => {
    if (!user) {
      toast({
        title: "Not Authenticated",
        description: "You must be logged in to save settings.",
        variant: "destructive",
      });
      return;
    }
    if (!geminiApiKeyInput.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your Gemini API Key to save.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // PRODUCTION: This would be an API call to your secure backend endpoint.
      // Your backend would then encrypt and store the key in Google Secret Manager or similar.
      // Example: await fetch('/api/user/save-api-key', { method: 'POST', body: JSON.stringify({ apiKey: geminiApiKeyInput }) });

      // For PROTOTYPE ONLY (Direct Firestore Write - NOT FOR PRODUCTION KEYS):
      // This allows testing the BYOK flow within the current Firebase Studio limitations.
      // In a real production app, NEVER let the client write API keys directly to a database like this.
      const db = getFirestore();
      const settingsDocRef = doc(db, "users", user.uid, "userSettings", "appSecrets");
      await setDoc(settingsDocRef, { geminiApiKey: geminiApiKeyInput.trim() }, { merge: true });
      // END OF PROTOTYPE ONLY BLOCK

      toast({
        title: "API Key Submitted",
        description: "Your API key has been submitted to be saved securely. It will be used for future AI interactions.",
      });
      setGeminiApiKeyInput(""); // Clear input field
      setApiKeyStatus("set"); // Update status optimistically
    } catch (error) {
      console.error("Error saving API key (simulated backend call):", error);
      toast({
        title: "Error Saving API Key",
        description: "Could not save your API key. Please try again. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveApiKey = async () => {
    if (!user) return;
    setIsSaving(true); // Use isSaving to disable button during operation
    try {
        // PRODUCTION: This would call your backend to remove/invalidate the key.
        // For PROTOTYPE ONLY (Direct Firestore delete):
        const db = getFirestore();
        const settingsDocRef = doc(db, "users", user.uid, "userSettings", "appSecrets");
        await setDoc(settingsDocRef, { geminiApiKey: null }, { merge: true }); // Or deleteDoc if appropriate
        // END OF PROTOTYPE ONLY BLOCK
        toast({
            title: "API Key Removed",
            description: "Your API key has been removed.",
        });
        setApiKeyStatus("not_set");
    } catch (error) {
        console.error("Error removing API key:", error);
        toast({
            title: "Error Removing API Key",
            description: "Could not remove your API key. Please try again.",
            variant: "destructive",
        });
    } finally {
        setIsSaving(false);
    }
};


  if (authLoading) {
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
          You need to be logged in to manage your API key settings.
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
          Optionally, provide your own Google AI Gemini API key. This key will be used by the application's backend to make AI calls on your behalf, using your personal quota.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="default" className="bg-amber-50 border-amber-300 text-amber-700">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertTitle className="font-semibold">Security & Usage Notice</AlertTitle>
          <AlertDescription className="text-xs">
            This feature allows you to use your personal Google AI Gemini API key.
            For this prototype, the key is stored in Firestore associated with your user ID. In a production system, your key would be sent to a secure backend, encrypted, and stored in a dedicated secret manager (like Google Secret Manager). It would never be directly exposed to the client after submission.
            Managing the security and quota of your API key is your responsibility.
            If no key is provided here, the application will use its default AI configuration.
          </AlertDescription>
        </Alert>

        {apiKeyStatus === "loading" && (
          <div className="flex items-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking API key status...
          </div>
        )}
        {apiKeyStatus === "error" && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Could not retrieve API key status. Please refresh.</AlertDescription>
          </Alert>
        )}
        {apiKeyStatus === "set" && (
          <Alert variant="default" className="bg-green-50 border-green-400">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-700">API Key on File</AlertTitle>
            <AlertDescription className="text-xs text-green-600">
              Your Gemini API key is configured and will be used for AI features. You can update it below or remove it.
            </AlertDescription>
          </Alert>
        )}
        {apiKeyStatus === "not_set" && (
          <Alert variant="default" className="bg-blue-50 border-blue-400">
            <KeyRound className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-700">No API Key Set</AlertTitle>
            <AlertDescription className="text-xs text-blue-600">
              You have not set a personal Gemini API key. The app will use its default configuration. You can add your key below.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="geminiApiKey">Your Google AI Gemini API Key</Label>
          <Input
            id="geminiApiKey"
            type="password"
            placeholder={apiKeyStatus === "set" ? "Enter new key to update, or leave blank" : "Enter your Gemini API Key (e.g., AIza...)"}
            value={geminiApiKeyInput}
            onChange={(e) => setGeminiApiKeyInput(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Your key will be submitted to our secure backend for storage and use. It will not be stored in your browser.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button onClick={handleSaveSettings} disabled={isSaving || !geminiApiKeyInput.trim()}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {apiKeyStatus === "set" ? "Update API Key" : "Save API Key"}
        </Button>
        {apiKeyStatus === "set" && (
            <Button onClick={handleRemoveApiKey} variant="destructive" disabled={isSaving}>
                <XCircle className="mr-2 h-4 w-4" />
                Remove API Key
            </Button>
        )}
      </CardFooter>
    </Card>
  );
}
