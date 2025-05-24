
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { getFirestore, collection, query, orderBy, onSnapshot, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PlusCircle, Edit3, Trash2, Loader2, AlertTriangle, Trophy } from 'lucide-react';
import { AddAchievementForm } from './add-achievement-form'; // Ensure this path is correct
import type { Achievement } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function AchievementsManager() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);

  useEffect(() => {
    if (!user || authLoading) {
      if (!authLoading) setIsLoading(false); // If auth is done and no user, stop loading
      return;
    }

    setIsLoading(true);
    const db = getFirestore();
    const achievementsCol = collection(db, 'users', user.uid, 'achievements');
    const q = query(achievementsCol, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const userAchievements: Achievement[] = [];
      querySnapshot.forEach((doc) => {
        userAchievements.push({ id: doc.id, ...doc.data() } as Achievement);
      });
      setAchievements(userAchievements);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching achievements:", error);
      toast({
        title: "Error Fetching Achievements",
        description: "Could not load your achievements. Please try again later.",
        variant: "destructive",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, toast]);

  const handleAddAchievement = () => {
    setEditingAchievement(null);
    setIsFormOpen(true);
  };

  const handleEditAchievement = (achievement: Achievement) => {
    setEditingAchievement(achievement);
    setIsFormOpen(true);
  };

  const handleDeleteAchievement = async (achievementId: string) => {
    if (!user) {
        toast({ title: "Error", description: "You must be logged in to delete achievements.", variant: "destructive" });
        return;
    }
    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'users', user.uid, 'achievements', achievementId));
      toast({
        title: "Achievement Deleted",
        description: "Your achievement has been successfully deleted.",
      });
    } catch (error) {
      console.error("Error deleting achievement: ", error);
      toast({
        title: "Error Deleting Achievement",
        description: "Could not delete the achievement. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading achievements...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-orange-400 mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground">Please Log In</h2>
        <p className="text-muted-foreground">You need to be logged in to view and manage your achievements.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogTrigger asChild>
          <Button onClick={handleAddAchievement} className="w-full sm:w-auto bg-primary hover:bg-primary/90">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Achievement
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Trophy className="mr-2 h-6 w-6 text-primary" />
              {editingAchievement ? 'Edit Achievement' : 'Add New Achievement'}
            </DialogTitle>
            <DialogDescription>
              {editingAchievement ? 'Update the details of your achievement.' : 'Document your accomplishment using the STAR method.'}
            </DialogDescription>
          </DialogHeader>
          <AddAchievementForm
            userId={user.uid}
            existingAchievement={editingAchievement}
            onFormSubmit={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {achievements.length === 0 && !isLoading && (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
            <Trophy className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-xl font-semibold text-muted-foreground">No Achievements Yet</h3>
          <p className="text-muted-foreground mt-1">Start logging your accomplishments to track your progress!</p>
          <Button onClick={handleAddAchievement} className="mt-6">
            <PlusCircle className="mr-2 h-5 w-5" /> Add Your First Achievement
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {achievements.map((achievement) => (
          <Card key={achievement.id} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-xl text-primary">{achievement.title}</CardTitle>
              {achievement.dateAchieved && (
                 <CardDescription>
                    Achieved on: {new Date(achievement.dateAchieved).toLocaleDateString()}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <h4 className="font-semibold text-muted-foreground">Situation:</h4>
                <p className="whitespace-pre-wrap text-foreground/90">{achievement.situation}</p>
              </div>
              <div>
                <h4 className="font-semibold text-muted-foreground">Task:</h4>
                <p className="whitespace-pre-wrap text-foreground/90">{achievement.task}</p>
              </div>
              <div>
                <h4 className="font-semibold text-muted-foreground">Action:</h4>
                <p className="whitespace-pre-wrap text-foreground/90">{achievement.action}</p>
              </div>
              <div>
                <h4 className="font-semibold text-muted-foreground">Result:</h4>
                <p className="whitespace-pre-wrap text-foreground/90">{achievement.result}</p>
              </div>
              {achievement.quantifiableImpact && (
                <div>
                  <h4 className="font-semibold text-muted-foreground">Quantifiable Impact:</h4>
                  <p className="whitespace-pre-wrap text-foreground/90">{achievement.quantifiableImpact}</p>
                </div>
              )}
              {achievement.skillsDemonstrated && achievement.skillsDemonstrated.length > 0 && (
                <div>
                  <h4 className="font-semibold text-muted-foreground">Skills Demonstrated:</h4>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {achievement.skillsDemonstrated.map(skill => (
                      <span key={skill} className="px-2 py-0.5 text-xs bg-secondary text-secondary-foreground rounded-full">{skill}</span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => handleEditAchievement(achievement)}>
                <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete this achievement.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteAchievement(achievement.id!)}>
                      Yes, delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
