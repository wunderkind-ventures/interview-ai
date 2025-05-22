
"use client";

import type { User } from "firebase/auth";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { getApps, initializeApp, getApp } from 'firebase/app'; // For checking Firebase app initialization
import { useToast } from "@/hooks/use-toast";

// Ensure Firebase is initialized (this is a common pattern, ideally done once in a dedicated firebase.ts)
// For this example, we'll use a simplified check. Replace with your actual Firebase config.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app;
if (!getApps().length) {
  if (firebaseConfig.projectId) { // Only initialize if config is somewhat present
    app = initializeApp(firebaseConfig);
  } else {
    console.warn("Firebase config is missing. Authentication will not work.");
  }
} else {
  app = getApp();
}

const auth = app ? getAuth(app) : null;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) {
        toast({ title: "Authentication Error", description: "Firebase Auth not initialized.", variant: "destructive"});
        return;
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast({ title: "Signed In", description: "Successfully signed in with Google.", variant: "default"});
    } catch (error) {
      console.error("Error signing in with Google:", error);
      toast({ title: "Sign In Error", description: "Could not sign in with Google. Please try again.", variant: "destructive"});
    }
  };

  const logout = async () => {
    if (!auth) {
        toast({ title: "Authentication Error", description: "Firebase Auth not initialized.", variant: "destructive"});
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
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
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
