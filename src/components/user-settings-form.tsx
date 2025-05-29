
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Save, AlertTriangle, KeyRound, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GO_BACKEND_URL = process.env.NEXT_PUBLIC_GO_BACKEND_URL || 'http://localhost:8080';

export default function UserSettingsForm() {
  const { user, loading: authLoading, authInitializationFailed } = useAuth();
  const { toast } = useToast();
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState<"loading" | "set" | "not_set" | "error">("loading");
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchApiKeyStatus = async () => {
    if (!user || authInitializationFailed) {
      setApiKeyStatus(authInitializationFailed ? "error" : "not_set");
      setIsProcessing(false);
      return;
    }
    setApiKeyStatus("loading");
    setIsProcessing(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`${GO_BACKEND_URL}/api/user/api-key-status`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(`Failed to fetch API key status: ${response.status} ${errorData.detail || errorData.error || ''}`);
      }
      const data = await response.json();
      setApiKeyStatus(data.hasKey ? "set" : "not_set");
    } catch (error) {
      console.error("Error fetching API key status from backend:", error);
      setApiKeyStatus("error");
      toast({
        title: "Error Loading API Key Status",
        description: error instanceof Error ? error.message : "Could not determine if an API key is set.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchApiKeyStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, authInitializationFailed]);

  const handleSaveSettings = async () => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!geminiApiKeyInput.trim()) {
      toast({ title: "API Key Required", description: "Please enter your Gemini API Key.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`${GO_BACKEND_URL}/api/user/set-api-key`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: geminiApiKeyInput.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(`Failed to save API key: ${response.status} ${errorData.detail || errorData.error || ''}`);
      }
      
      toast({
        title: "API Key Submitted",
        description: "Your API key has been securely submitted.",
      });
      setGeminiApiKeyInput("");
      setApiKeyStatus("set");
    } catch (error) {
      console.error("Error saving API key to backend:", error);
      toast({
        title: "Error Saving API Key",
        description: error instanceof Error ? error.message : "Could not save your API key. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveApiKey = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`${GO_BACKEND_URL}/api/user/remove-api-key`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(`Failed to remove API key: ${response.status} ${errorData.detail || errorData.error || ''}`);
      }
      toast({ title: "API Key Removed", description: "Your API key has been removed." });
      setApiKeyStatus("not_set");
    } catch (error) {
      console.error("Error removing API key from backend:", error);
      toast({
        title: "Error Removing API Key",
        description: error instanceof Error ? error.message : "Could not remove your API key.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
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

  if (!user && !authInitializationFailed) { // Show login prompt only if auth is initialized and no user
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
  
  if (authInitializationFailed) {
     return (
        <div className="text-center py-12">
         <Alert variant="destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Authentication Error</AlertTitle>
            <AlertDescription>Could not initialize Firebase Authentication. API Key settings are unavailable. Please check your Firebase project setup and environment variables.</AlertDescription>
         </Alert>
        </div>
     )
  }


  return (
    <Card className="w-full max-w-lg mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl text-primary">
          <KeyRound className="mr-2 h-6 w-6" /> API Key Management (BYOK)
        </CardTitle>
        <CardDescription>
          Optionally, provide your own Google AI Gemini API key. This key will be sent to our secure backend and used to make AI calls on your behalf, using your personal quota.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="default" className="bg-amber-50 border-amber-300 text-amber-700">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertTitle className="font-semibold">Security & Usage Notice</AlertTitle>
          <AlertDescription className="text-xs">
            Your API key will be sent to our secure backend, and stored in Google Secret Manager.
            Managing the security and quota of your API key is your responsibility.
            If no key is provided, the application will use its default AI configuration.
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
            <AlertDescription>Could not retrieve API key status. Please try refreshing the page. If the problem persists, ensure the backend service is running and accessible.</AlertDescription>
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
            placeholder={apiKeyStatus === "set" ? "Enter new key to update, or leave blank to keep current" : "Enter your Gemini API Key (e.g., AIza...)"}
            value={geminiApiKeyInput}
            onChange={(e) => setGeminiApiKeyInput(e.target.value)}
            disabled={isProcessing || authInitializationFailed || !user}
          />
          <p className="text-xs text-muted-foreground">
            Your key will be submitted to our secure backend.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button onClick={handleSaveSettings} disabled={isProcessing || authInitializationFailed || !geminiApiKeyInput.trim() || !user}>
          {isProcessing && apiKeyStatus !== "set" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {apiKeyStatus === "set" ? "Update API Key" : "Save API Key"}
        </Button>
        {apiKeyStatus === "set" && (
            <Button onClick={handleRemoveApiKey} variant="destructive" disabled={isProcessing || authInitializationFailed || !user}>
                {isProcessing && apiKeyStatus === "set" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                Remove API Key
            </Button>
        )}
      </CardFooter>
    </Card>
  );
}
