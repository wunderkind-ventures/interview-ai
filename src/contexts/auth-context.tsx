
"use client";

import type { User } from "firebase/auth";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { getApps, initializeApp, getApp, type FirebaseOptions } from 'firebase/app';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

// Ensure Firebase is initialized
// IMPORTANT: For this to work, you MUST set up environment variables.
// For local development, create a .env.local file in the root of your project.
// For deployed environments, configure these in your hosting provider's settings.
// Example variables:
// NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
// NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
// NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
// NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
// NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
// NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
// After adding/changing these, restart your development server or redeploy.

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app;
let authInitializationFailedInitially = false;

if (!getApps().length) {
  if (firebaseConfig.projectId && firebaseConfig.apiKey) { 
    try {
      app = initializeApp(firebaseConfig);
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        authInitializationFailedInitially = true;
    }
  } else {
    console.warn(
      "Firebase configuration is missing or incomplete. " +
      "Please ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID and NEXT_PUBLIC_FIREBASE_API_KEY " +
      "(and other config values) are set in your environment. " +
      "For local development, check .env.local and restart your dev server. " +
      "For deployed apps, check your hosting provider's environment variable settings. " +
      "Authentication will not work."
    );
    authInitializationFailedInitially = true;
  }
} else {
  app = getApp();
}

const auth = app && !authInitializationFailedInitially ? getAuth(app) : null;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  authInitializationFailed: boolean;
  firebaseConfig: FirebaseOptions | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authInitializationFailed, setAuthInitializationFailed] = useState(authInitializationFailedInitially);
  const { toast } = useToast();

  useEffect(() => {
    if (!auth) {
      console.error(
        "Firebase Auth instance is not available. This is likely because Firebase App initialization failed. " +
        "Ensure your Firebase project configuration (API Key, Project ID, etc.) is correctly set up. " +
        "For local development, check your .env.local file and restart your development server. " +
        "For deployed environments, ensure these environment variables are set in your hosting provider's settings. " +
        "Auth features will be disabled."
      );
      setAuthInitializationFailed(true); // Explicitly set here if auth is null
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // Do not set authInitializationFailed to false here if it was already true
      // setAuthInitializationFailed(false); 
      setLoading(false);
    }, (error) => {
        console.error("Firebase onAuthStateChanged error:", error);
        setAuthInitializationFailed(true);
        setLoading(false);
        toast({
            title: "Authentication Monitoring Error",
            description: `Failed to monitor authentication state: ${error.message}. Please try refreshing the page.`,
            variant: "destructive"
        });
    });
    return () => unsubscribe();
  }, [toast]);

  const signInWithGoogle = async () => {
    if (!auth) {
        toast({
            title: "Authentication System Error",
            description: "Firebase Authentication is not properly initialized. Cannot sign in. Please ensure your Firebase project configuration (API Key, Project ID, etc.) is correctly set up. For local development, verify your .env.local file and restart the development server. For deployed applications, confirm these environment variables are configured in your hosting provider's settings.",
            variant: "destructive",
            duration: 10000,
        });
        console.error("Attempted to sign in, but Firebase Auth is not initialized.");
        setAuthInitializationFailed(true); // Ensure state reflects this critical failure
        return;
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast({ title: "Signed In", description: "Successfully signed in with Google.", variant: "default"});
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      let description = "Could not sign in with Google. Please try again.";
      if (error.code === 'auth/operation-not-allowed' ||
          (error.message && (error.message.includes('auth/operation-not-allowed') || error.message.includes('The identity provider configuration is not found')))) {
        description = "Google Sign-In may not be enabled for this project in the Firebase console. Please check your Authentication settings.";
      } else if (error.code === 'auth/popup-closed-by-user') {
        description = "Sign-in popup was closed before completing. Please try again.";
      } else if (error.code === 'auth/unauthorized-domain') {
        const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'your current domain';
        description = `The domain '${currentDomain}' is not authorized for Firebase Authentication. Please add it to the 'Authorized domains' list in your Firebase project's Authentication settings. (Error: ${error.code})`;
      } else if (error.code) {
        description = `Could not sign in with Google (Error: ${error.code}). Please try again.`;
      }
      toast({ title: "Sign In Error", description, variant: "destructive"});
    }
  };

  const logout = async () => {
    if (!auth) {
        toast({
            title: "Authentication System Error",
            description: "Firebase Authentication is not properly initialized. Cannot sign out. Please check your Firebase setup and environment variables.",
            variant: "destructive",
            duration: 10000,
        });
        console.error("Attempted to sign out, but Firebase Auth is not initialized.");
        setAuthInitializationFailed(true); // Ensure state reflects this
        return;
    }
    try {
      await firebaseSignOut(auth);
      toast({ title: "Signed Out", description: "Successfully signed out.", variant: "default"});
    } catch (error) {
      console.error("Error signing out:", error);
      toast({ title: "Sign Out Error", description: "Could not sign out. Please try again.", variant: "destructive"});
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout, authInitializationFailed, firebaseConfig: (firebaseConfig.projectId && firebaseConfig.apiKey) ? firebaseConfig : null }}>
      {authInitializationFailed && (
        <div className="sticky top-0 z-[10000] w-full bg-background p-2 shadow-md">
          <Alert variant="destructive" className="container mx-auto">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Firebase Authentication Error</AlertTitle>
            <AlertDescription>
              Firebase Authentication could not be initialized. Please ensure your Firebase project configuration (API Key, Project ID, etc.) is correctly set up.
              For local development, check your <code>.env.local</code> file and restart your development server.
              For deployed environments, ensure these environment variables are set in your hosting provider's settings.
              Authentication features will be unavailable until this is resolved.
            </AlertDescription>
          </Alert>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

