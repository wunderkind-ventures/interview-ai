
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, KeyRound, Copy, Info, RefreshCw, ShieldAlert, Send, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GO_BACKEND_URL = process.env.NEXT_PUBLIC_GO_BACKEND_URL || 'http://localhost:8080';

interface ApiResponse {
  status: number;
  statusText: string;
  data: any;
  headers?: Record<string, string>;
}

export default function TestingUtilitiesPanel() {
  const { user, loading: authLoading, authInitializationFailed } = useAuth();
  const { toast } = useToast();

  const [firebaseToken, setFirebaseToken] = useState<string | null>(null);
  const [isTokenLoading, setIsTokenLoading] = useState(false);

  const [apiKeyStatusResponse, setApiKeyStatusResponse] = useState<ApiResponse | null>(null);
  const [setApiKeyInput, setSetApiKeyInput] = useState("");
  const [setApiKeyResponse, setSetApiKeyResponse] = useState<ApiResponse | null>(null);
  const [removeApiKeyResponse, setRemoveApiKeyResponse] = useState<ApiResponse | null>(null);

  const [flowNameInput, setFlowNameInput] = useState("customizeInterviewQuestions"); // Default to a common flow
  const [flowPayloadInput, setFlowPayloadInput] = useState(
    JSON.stringify(
      {
        interviewType: "behavioral",
        interviewStyle: "simple-qa",
        faangLevel: "L4",
        jobTitle: "Software Engineer",
        // Add other necessary fields for the default flowNameInput
      },
      null,
      2
    )
  );
  const [genkitProxyResponse, setGenkitProxyResponse] = useState<ApiResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const getFirebaseToken = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setFirebaseToken(null);
      return;
    }
    setIsTokenLoading(true);
    try {
      const token = await user.getIdToken(forceRefresh);
      setFirebaseToken(token);
    } catch (error) {
      console.error("Error getting Firebase token:", error);
      toast({ title: "Token Error", description: "Could not retrieve Firebase token.", variant: "destructive" });
      setFirebaseToken(null);
    } finally {
      setIsTokenLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user && !firebaseToken) {
      getFirebaseToken();
    }
  }, [user, firebaseToken, getFirebaseToken]);

  const handleCopyToClipboard = (text: string | null) => {
    if (text) {
      navigator.clipboard.writeText(text)
        .then(() => toast({ title: "Copied!", description: "Firebase ID token copied to clipboard." }))
        .catch(err => toast({ title: "Copy Failed", description: "Could not copy token.", variant: "destructive" }));
    }
  };

  const makeApiCall = async (
    endpoint: string,
    method: 'GET' | 'POST',
    body?: any
  ): Promise<ApiResponse> => {
    if (!firebaseToken) {
      throw new Error("Firebase token not available. Please refresh or log in.");
    }
    setIsProcessing(true);
    const targetUrl = `${GO_BACKEND_URL}${endpoint}`;
    console.log(`[API Call] Attempting ${method} to ${targetUrl}`);
    console.log(`[API Call] Using token: ${firebaseToken ? firebaseToken.substring(0, 20) + '...' : 'No token'}`);
    try {
      const response = await fetch(targetUrl, {
        method,
        headers: {
          'Authorization': `Bearer ${firebaseToken}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseBody = await response.json().catch(() => response.text());
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      return {
        status: response.status,
        statusText: response.statusText,
        data: responseBody,
        headers: responseHeaders,
      };
    } catch (error: any) {
      console.error(`[API Call] Error during ${method} to ${targetUrl}:`, error);
      let errorMessage = `Failed to fetch from ${targetUrl}.`;
      // Check if it's the generic "Failed to fetch" browser error
      if (error.message.toLowerCase().includes("failed to fetch")) {
        errorMessage += ` This often means a network issue, CORS problem, or the backend URL is incorrect.`;
        errorMessage += ` Please ensure NEXT_PUBLIC_GO_BACKEND_URL is set correctly in your .env.local (currently targeting: ${GO_BACKEND_URL}) and that the backend is reachable.`;
      } else {
        errorMessage += ` Details: ${error.message}`;
      }
      return {
        status: 0, // Indicate client-side error
        statusText: "FetchError",
        data: { error: "Client-side Fetch Error", details: errorMessage },
      };
    } finally {
      setIsProcessing(false);
    }
  };

  const testApiKeyStatus = async () => {
    setApiKeyStatusResponse(null);
    try {
      const res = await makeApiCall('/api/user/api-key-status', 'GET');
      setApiKeyStatusResponse(res);
    } catch (error: any) {
      setApiKeyStatusResponse({ status: 0, statusText: "ClientError", data: { error: error.message } });
    }
  };

  const testSetApiKey = async () => {
    if (!setApiKeyInput.trim()) {
      toast({ title: "Input Required", description: "Please enter an API key to set.", variant: "destructive" });
      return;
    }
    setSetApiKeyResponse(null);
    try {
      const res = await makeApiCall('/api/user/set-api-key', 'POST', { apiKey: setApiKeyInput.trim() });
      setSetApiKeyResponse(res);
      if (res.status === 200) {
        toast({ title: "API Key Set", description: "Successfully submitted API key."});
        testApiKeyStatus(); 
      } else {
        toast({ title: "Error Setting API Key", description: res.data?.error || res.data?.details || res.statusText, variant: "destructive" });
      }
    } catch (error: any) {
      setSetApiKeyResponse({ status: 0, statusText: "ClientError", data: { error: error.message } });
    }
  };
  
  const testRemoveApiKey = async () => {
    setRemoveApiKeyResponse(null);
    try {
      const res = await makeApiCall('/api/user/remove-api-key', 'POST');
      setRemoveApiKeyResponse(res);
       if (res.status === 200) {
        toast({ title: "API Key Removed", description: "Successfully removed API key."});
        testApiKeyStatus(); 
      } else {
        toast({ title: "Error Removing API Key", description: res.data?.error || res.data?.details || res.statusText, variant: "destructive" });
      }
    } catch (error: any) {
      setRemoveApiKeyResponse({ status: 0, statusText: "ClientError", data: { error: error.message } });
    }
  };

  const testGenkitProxy = async () => {
    if (!flowNameInput.trim()) {
      toast({ title: "Input Required", description: "Please enter a flow name.", variant: "destructive" });
      return;
    }
    let payload;
    try {
      payload = JSON.parse(flowPayloadInput);
    } catch (e) {
      toast({ title: "Invalid JSON", description: "Flow payload is not valid JSON.", variant: "destructive" });
      return;
    }
    setGenkitProxyResponse(null);
     try {
      const res = await makeApiCall(`/api/ai/genkit/${flowNameInput.trim()}`, 'POST', payload);
      setGenkitProxyResponse(res);
      if (res.status !== 200) {
        toast({ title: `Error Calling Flow (${res.status})`, description: res.data?.error || res.data?.details || res.statusText, variant: "destructive" });
      }
    } catch (error: any) {
      setGenkitProxyResponse({ status: 0, statusText: "ClientError", data: { error: error.message } });
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading authentication...</p>
      </div>
    );
  }

  if (authInitializationFailed || !user) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>
          {authInitializationFailed ? "Firebase Authentication failed to initialize. Please check your Firebase project setup and environment variables." : "You must be logged in to use these testing utilities."}
        </AlertDescription>
      </Alert>
    );
  }
  
  const renderResponse = (title: string, response: ApiResponse | null) => {
    if (!response) return null;
    return (
      <Card className="mt-2">
        <CardHeader className="p-3 bg-secondary/50 rounded-t-md">
          <CardTitle className="text-sm">{title} Response</CardTitle>
        </CardHeader>
        <CardContent className="p-3 text-xs">
          <p><strong>Status:</strong> {response.status} {response.statusText}</p>
          <p><strong>Headers (selected):</strong></p>
          <pre className="bg-muted p-2 rounded-md overflow-x-auto text-xs">
            {JSON.stringify({
              'content-type': response.headers?.['content-type'],
              'date': response.headers?.['date'],
            }, null, 2)}
          </pre>
          <p className="mt-2"><strong>Body:</strong></p>
          <pre className="bg-muted p-2 rounded-md overflow-x-auto text-xs">
            {typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)}
          </pre>
        </CardContent>
      </Card>
    );
  };


  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><KeyRound className="mr-2 h-5 w-5 text-primary" /> Firebase ID Token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isTokenLoading && <div className="flex items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Loading token...</div>}
          {firebaseToken && !isTokenLoading && (
            <Textarea value={firebaseToken} readOnly rows={5} className="text-xs bg-muted" />
          )}
          {!firebaseToken && !isTokenLoading && <Alert variant="default"><Info className="h-4 w-4"/>Token not available. Are you logged in?</Alert>}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={() => getFirebaseToken(true)} disabled={isTokenLoading || isProcessing}>
            <RefreshCw className="mr-2 h-4 w-4"/> Refresh Token
          </Button>
          <Button onClick={() => handleCopyToClipboard(firebaseToken)} variant="outline" disabled={!firebaseToken || isProcessing}>
            <Copy className="mr-2 h-4 w-4"/> Copy Token
          </Button>
        </CardFooter>
      </Card>

      {/* API Key Status */}
      <Card>
        <CardHeader>
          <CardTitle>API Key Status</CardTitle>
          <CardDescription>Test the <code>GET /api/user/api-key-status</code> endpoint.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={testApiKeyStatus} disabled={isProcessing || !firebaseToken}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Test Status
          </Button>
        </CardFooter>
        {renderResponse("API Key Status", apiKeyStatusResponse)}
      </Card>

      {/* Set API Key */}
      <Card>
        <CardHeader>
          <CardTitle>Set API Key</CardTitle>
          <CardDescription>Test the <code>POST /api/user/set-api-key</code> endpoint.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="setApiKey">Gemini API Key</Label>
          <Input 
            id="setApiKey" 
            type="password" 
            value={setApiKeyInput} 
            onChange={(e) => setSetApiKeyInput(e.target.value)}
            placeholder="Enter your Gemini API Key"
            disabled={isProcessing}
          />
        </CardContent>
        <CardFooter>
          <Button onClick={testSetApiKey} disabled={isProcessing || !firebaseToken || !setApiKeyInput.trim()}>
             {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Set Key
          </Button>
        </CardFooter>
        {renderResponse("Set API Key", setApiKeyResponse)}
      </Card>
      
      {/* Remove API Key */}
      <Card>
        <CardHeader>
          <CardTitle>Remove API Key</CardTitle>
          <CardDescription>Test the <code>POST /api/user/remove-api-key</code> endpoint.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={testRemoveApiKey} variant="destructive" disabled={isProcessing || !firebaseToken}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>} Remove Key
          </Button>
        </CardFooter>
        {renderResponse("Remove API Key", removeApiKeyResponse)}
      </Card>

      {/* Genkit Proxy */}
      <Card>
        <CardHeader>
          <CardTitle>Genkit Proxy</CardTitle>
          <CardDescription>Test the <code>POST /api/ai/genkit/[flowName]</code> endpoint.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="flowName">Flow Name</Label>
            <Input 
              id="flowName" 
              value={flowNameInput} 
              onChange={(e) => setFlowNameInput(e.target.value)}
              placeholder="e.g., customizeInterviewQuestions"
              disabled={isProcessing}
            />
          </div>
          <div>
            <Label htmlFor="flowPayload">Flow Payload (JSON)</Label>
            <Textarea 
              id="flowPayload" 
              value={flowPayloadInput} 
              onChange={(e) => setFlowPayloadInput(e.target.value)}
              rows={8}
              placeholder='{ "interviewType": "behavioral", ... }'
              className="font-mono text-xs"
              disabled={isProcessing}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={testGenkitProxy} disabled={isProcessing || !firebaseToken || !flowNameInput.trim()}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>} Call Flow
          </Button>
        </CardFooter>
        {renderResponse("Genkit Proxy", genkitProxyResponse)}
      </Card>
    </div>
  );
}
