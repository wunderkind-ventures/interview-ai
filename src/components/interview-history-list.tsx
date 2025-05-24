
"use client";

import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, Inbox, Eye } from 'lucide-react';
import Link from 'next/link';
import type { InterviewSessionData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { INTERVIEW_TYPES, INTERVIEW_STYLES, FAANG_LEVELS } from '@/lib/constants';

interface StoredInterviewSession extends Omit<InterviewSessionData, 'completedAt'> {
  id: string;
  completedAt: Timestamp; // Firestore Timestamp
}

export default function InterviewHistoryList() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [interviews, setInterviews] = useState<StoredInterviewSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || authLoading) {
      if (!authLoading) {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);

    const db = getFirestore();
    if (!db) {
        toast({ title: "Database Error", description: "Could not connect to the database. Please ensure Firebase is configured correctly.", variant: "destructive"});
        console.error("Firestore DB instance is null in InterviewHistoryList.");
        setIsLoading(false);
        return;
    }

    const interviewsCol = collection(db, 'users', user.uid, 'interviews');
    const q = query(interviewsCol, orderBy('completedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const userInterviews: StoredInterviewSession[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        let completedAt = data.completedAt;
        // Ensure completedAt is a Firestore Timestamp before calling toDate()
        if (completedAt && typeof completedAt.toDate !== 'function' && completedAt.seconds) {
            completedAt = new Timestamp(completedAt.seconds, completedAt.nanoseconds);
        }
        userInterviews.push({ 
            id: doc.id, 
            ...data,
            completedAt: completedAt, // This should now be a valid Timestamp or null/undefined
        } as StoredInterviewSession);
      });
      setInterviews(userInterviews);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching interview history:", error);
      const errorMessage = "Could not load your interview history. Please try again later.";
      toast({
        title: "Error Fetching History",
        description: errorMessage,
        variant: "destructive",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, toast]);

  const getLabel = (value: string, options: readonly { value: string; label: string }[]) => {
    return options.find(opt => opt.value === value)?.label || value;
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading interview history...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-orange-400 mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground">Please Log In</h2>
        <p className="text-muted-foreground">You need to be logged in to view your interview history.</p>
      </div>
    );
  }

  if (interviews.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
        <Inbox className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-xl font-semibold text-muted-foreground">No Interview History Yet</h3>
        <p className="text-muted-foreground mt-1">Complete some mock interviews to see your progress here!</p>
        <Button asChild className="mt-6">
          <Link href="/">Start New Interview</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {interviews.map((interview) => (
        <Card key={interview.id} className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-xl text-primary">
              {getLabel(interview.interviewType, INTERVIEW_TYPES)} Interview
            </CardTitle>
            <CardDescription className="text-sm">
              Completed on: {interview.completedAt?.toDate ? interview.completedAt.toDate().toLocaleDateString() : 'N/A'}
              {interview.completedAt?.toDate ? ` at ${interview.completedAt.toDate().toLocaleTimeString()}`: ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><strong>Style:</strong> {getLabel(interview.interviewStyle, INTERVIEW_STYLES)}</p>
            <p><strong>Level:</strong> {getLabel(interview.faangLevel, FAANG_LEVELS)}</p>
            {interview.jobTitle && <p><strong>Job Title:</strong> {interview.jobTitle}</p>}
            {interview.targetCompany && <p><strong>Target Company:</strong> {interview.targetCompany}</p>}
            {interview.interviewFocus && <p><strong>Focus:</strong> {interview.interviewFocus}</p>}
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" size="sm">
              <Link href={`/feedback?sessionId=${interview.id}`}>
                <Eye className="mr-2 h-4 w-4" /> View Summary
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
