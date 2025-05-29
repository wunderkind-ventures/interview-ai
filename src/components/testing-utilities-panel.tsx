
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, KeyRound, Copy, Info, RefreshCw, ShieldAlert, Send, Trash2, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GO_BACKEND_URL = process.env.NEXT_PUBLIC_GO_BACKEND_URL || 'http://localhost:8080';
const EXPECTED_FIREBASE_ISSUER_PREFIX = "https://securetoken.google.com/";


interface ApiResponse {
  status: number;
  statusText: string;
  data: any;
  headers?: Record<string, string>;
}

interface DecodedTokenInfo {
  issuer?: string;
  audience?: string;
  userId?: string;
  email?: string;
  expiresAt?: string;
  isFirebaseToken?: boolean;
  expectedIssuer?: string;
}

export default function TestingUtilitiesPanel() {
  const { user, loading: authLoading, authInitializationFailed, firebaseConfig } = useAuth();
  const { toast } = useToast();

  const [firebaseToken, setFirebaseToken] = useState<string | null>(null);
  const [decodedTokenInfo, setDecodedTokenInfo] = useState<DecodedTokenInfo | null>(null);
  const [isTokenLoading, setIsTokenLoading] = useState(false);

  const [apiKeyStatusResponse, setApiKeyStatusResponse] = useState<ApiResponse | null>(null);
  const [setApiKeyInput, setSetApiKeyInput] = useState("");
  const [setApiKeyResponse, setSetApiKeyResponse] = useState<ApiResponse | null>(null);
  const [removeApiKeyResponse, setRemoveApiKeyResponse] = useState<ApiResponse | null>(null);

  const [flowNameInput, setFlowNameInput] = useState("customizeInterviewQuestions");
  const [flowPayloadInput, setFlowPayloadInput] = useState(
    JSON.stringify(
      {
        interviewType: "behavioral",
        interviewStyle: "simple-qa",
        faangLevel: "L4",
        jobTitle: "Software Engineer",
      },
      null,
      2
    )
  );
  const [genkitProxyResponse, setGenkitProxyResponse] = useState<ApiResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const decodeToken = useCallback((token: string | null): DecodedTokenInfo | null => {
    if (!token) return null;
    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return { issuer: "Invalid token format (no payload)" };
      const payloadString = atob(payloadBase64);
      const payload = JSON.parse(payloadString);
      
      const currentProjectId = firebaseConfig?.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const expectedIssuerValue = currentProjectId 
        ? `${EXPECTED_FIREBASE_ISSUER_PREFIX}${currentProjectId}` 
        : `N/A (Firebase project ID not found. NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'not set'})`;
      
      return {
        issuer: payload.iss,
        audience: payload.aud,
        userId: payload.user_id || payload.sub,
        email: payload.email,
        expiresAt: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : "N/A",
        isFirebaseToken: payload.iss === expectedIssuerValue && currentProjectId !== undefined,
        expectedIssuer: expectedIssuerValue
      };
    } catch (e) {
      console.error("Failed to decode token:", e);
      return { issuer: "Invalid token format (decoding error)" };
    }
  }, [firebaseConfig?.projectId]);

  const getFirebaseToken = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setFirebaseToken(null);
      setDecodedTokenInfo(null);
      return;
    }
    setIsTokenLoading(true);
    try {
      const token = await user.getIdToken(forceRefresh);
      setFirebaseToken(token);
      setDecodedTokenInfo(decodeToken(token));
    } catch (error) {
      console.error("Error getting Firebase token:", error);
      toast({ title: "Token Error", description: "Could not retrieve Firebase token.", variant: "destructive" });
      setFirebaseToken(null);
      setDecodedTokenInfo(null);
    } finally {
      setIsTokenLoading(false);
    }
  }, [user, toast, decodeToken]);

  useEffect(() => {
    if (user && !firebaseToken && !authLoading && !authInitializationFailed) {
      getFirebaseToken();
    }
  }, [user, firebaseToken, getFirebaseToken, authLoading, authInitializationFailed]);

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
      toast({ title: "Token Missing", description: "Firebase token is not available. Please refresh or log in.", variant: "destructive" });
      return { status: 0, statusText: "ClientError_NoToken", data: { error: "Firebase token not available on client." } };
    }
    setIsProcessing(true);
    const targetUrl = `${GO_BACKEND_URL}${endpoint}`;
    
    console.log(`[API Call] Attempting ${method} to ${targetUrl}`);
    const tokenStart = firebaseToken.substring(0, 30);
    const tokenEnd = firebaseToken.substring(firebaseToken.length - 30);
    console.log(`[API Call] Token string being sent: ${tokenStart}...${tokenEnd}`);
    const tokenBeingSentDecoded = decodeToken(firebaseToken);
    console.log(`[API Call] Decoded claims of token being sent:`, tokenBeingSentDecoded);

    if (tokenBeingSentDecoded && tokenBeingSentDecoded.issuer !== tokenBeingSentDecoded.expectedIssuer) {
      console.warn(`[API Call] WARNING: The token being sent from frontend has issuer "${tokenBeingSentDecoded.issuer}" but expected "${tokenBeingSentDecoded.expectedIssuer}". This will likely result in a 401 from the backend.`);
    }
    
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
      console.error(`[API Call] Fetch Error during ${method} to ${targetUrl}:`, error);
      let errorMessage = `Failed to fetch from ${targetUrl}.`;
      let errorDetails = `This often means a network issue, CORS problem, or the backend URL is incorrect/unreachable.`;
      if (error.message.toLowerCase().includes("failed to fetch")) {
        errorDetails += ` Please ensure NEXT_PUBLIC_GO_BACKEND_URL is set correctly in your .env.local (currently targeting: ${GO_BACKEND_URL}) and that the backend is reachable. Check browser console for more network details.`;
      } else {
        errorDetails += ` Raw error: ${error.message}`;
      }
      return {
        status: 0,
        statusText: "FetchError_ClientSide",
        data: { error: errorMessage, details: errorDetails },
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
    } catch (error: any) { // Should be caught by makeApiCall now
      setApiKeyStatusResponse({ status: 0, statusText: "ClientError_Outer", data: { error: error.message } });
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
        const errorDetail = res.data?.error || res.data?.details || JSON.stringify(res.data) || res.statusText;
        toast({ title: "Error Setting API Key", description: errorDetail, variant: "destructive" });
      }
    } catch (error: any) {  // Should be caught by makeApiCall now
      setSetApiKeyResponse({ status: 0, statusText: "ClientError_Outer", data: { error: error.message } });
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
        const errorDetail = res.data?.error || res.data?.details || JSON.stringify(res.data) || res.statusText;
        toast({ title: "Error Removing API Key", description: errorDetail, variant: "destructive" });
      }
    } catch (error: any) { // Should be caught by makeApiCall now
      setRemoveApiKeyResponse({ status: 0, statusText: "ClientError_Outer", data: { error: error.message } });
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
        const errorDetail = res.data?.error || res.data?.details || JSON.stringify(res.data) || res.statusText;
        toast({ title: `Error Calling Flow (${res.status})`, description: errorDetail, variant: "destructive" });
      }
    } catch (error: any) { // Should be caught by makeApiCall now
      setGenkitProxyResponse({ status: 0, statusText: "ClientError_Outer", data: { error: error.message } });
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
              // Add other relevant headers if needed, e.g., 'x-cloud-trace-context'
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
            <>
              <Textarea value={firebaseToken} readOnly rows={5} className="text-xs bg-muted" />
              {decodedTokenInfo && (
                <Alert variant={decodedTokenInfo.isFirebaseToken ? "default" : "destructive"} className="text-xs">
                  <Info className="h-4 w-4" />
                  <AlertTitle className={decodedTokenInfo.isFirebaseToken ? "text-green-700" : "text-red-700"}>
                    Token Issuer Analysis: {decodedTokenInfo.isFirebaseToken ? "Valid Firebase Token" : "Potentially Invalid Token for Firebase Backend"}
                  </AlertTitle>
                  <AlertDescription>
                    <p><strong>Issuer (iss):</strong> {decodedTokenInfo.issuer || "N/A"}</p>
                    <p><strong>Expected Issuer:</strong> {decodedTokenInfo.expectedIssuer || "N/A"}</p>
                    <p><strong>Audience (aud):</strong> {decodedTokenInfo.audience || "N/A"}</p>
                    <p><strong>User ID (user_id/sub):</strong> {decodedTokenInfo.userId || "N/A"}</p>
                    <p><strong>Email:</strong> {decodedTokenInfo.email || "N/A"}</p>
                    <p><strong>Expires At:</strong> {decodedTokenInfo.expiresAt || "N/A"}</p>
                    {!decodedTokenInfo.isFirebaseToken && decodedTokenInfo.issuer !== "Invalid token format (decoding error)" && decodedTokenInfo.issuer !== "Invalid token format (no payload)" && (
                       <div className="mt-2 font-semibold">
                         This token was likely issued by "{decodedTokenInfo.issuer}" and NOT by Firebase for project "{firebaseConfig?.projectId}".
                         Your backend expects an issuer of "{decodedTokenInfo.expectedIssuer}".
                         Try signing out and signing back in using the app's "Login with Google" button.
                         Refer to <code className="bg-destructive/20 p-1 rounded-sm text-xs">FIREBASE_AUTH_FIX.md</code> for more details.
                       </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </>
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
           <a href="https://docs.google.com/document/d/1o0Q0ybt4W9C0K9H8iV8h3kL7R1H-2-8D9vY4X7oJ3E/edit#heading=h.x8j7k6z0q2wl" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-800 underline">
            <HelpCircle className="mr-1 h-4 w-4" /> Token Troubleshooting Guide
          </a>
        </CardFooter>
      </Card>

      <Alert variant="default" className="bg-blue-50 border-blue-300 text-blue-700">
        <Info className="h-5 w-5" />
        <AlertTitle>Important Testing Notes</AlertTitle>
        <AlertDescription>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Ensure <code>NEXT_PUBLIC_GO_BACKEND_URL</code> is set in your <code>.env.local</code> (e.g., <code>https://byot-gateway-1ntw604r.uc.gateway.dev</code>) and your Next.js dev server has been restarted. Its current value for the frontend is: <strong>{GO_BACKEND_URL}</strong>.</li>
            <li>If you see "Failed to fetch", check your browser's console for detailed network errors (CORS, etc.).</li>
            <li>The Go backend functions require a valid Firebase ID token. If the token issuer is incorrect, calls will fail with a 401 error.</li>
            <li>The "Proxy to Genkit" requires your Next.js app to be running and accessible if <code>NEXTJS_BASE_URL</code> in Pulumi points to localhost.</li>
          </ul>
        </AlertDescription>
      </Alert>


      {/* API Key Status */}
      <Card>
        <CardHeader>
          <CardTitle>API Key Status</CardTitle>
          <CardDescription>Test the <code>GET /api/user/api-key-status</code> endpoint.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={testApiKeyStatus} disabled={isProcessing || !firebaseToken}>
            {isProcessing && apiKeyStatusResponse === null ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Test Status
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
             {isProcessing && setApiKeyResponse === null ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Set Key
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
            {isProcessing && removeApiKeyResponse === null ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>} Remove Key
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
            {isProcessing && genkitProxyResponse === null ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>} Call Flow
          </Button>
        </CardFooter>
        {renderResponse("Genkit Proxy", genkitProxyResponse)}
      </Card>
    </div>
  );
}

