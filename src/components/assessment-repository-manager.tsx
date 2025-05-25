
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getFirestore, collection, query, orderBy, onSnapshot, doc, addDoc, setDoc, deleteDoc, serverTimestamp, where, limit, startAfter, getDocs, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { PlusCircle, Edit3, Trash2, Loader2, AlertTriangle, Library, FileText, Tag, StickyNote, Briefcase, Eye, Search, Filter } from 'lucide-react';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { SharedAssessmentDocument, InterviewType, InterviewStyle, FaangLevel } from '@/lib/types';
import { INTERVIEW_TYPES, INTERVIEW_STYLES, FAANG_LEVELS } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from './ui/badge';


const assessmentFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(150, "Title must be 150 characters or less."),
  assessmentType: z.custom<InterviewType>((val) => INTERVIEW_TYPES.some(it => it.value === val), {
    message: "Please select an assessment type.",
  }),
  assessmentStyle: z.custom<InterviewStyle | ''>((val) => val === '' || INTERVIEW_STYLES.some(is => is.value === val)).optional(),
  difficultyLevel: z.custom<FaangLevel | ''>((val) => val === '' || FAANG_LEVELS.some(fl => fl.value === val)).optional(),
  content: z.string().min(50, "Assessment content must be at least 50 characters.").max(10000, "Content must be 10000 characters or less."),
  keywords: z.string().optional().describe("Comma-separated list of keywords/tags."),
  notes: z.string().max(1000, "Notes must be 1000 characters or less.").optional(),
  source: z.string().max(150, "Source must be 150 characters or less.").optional(),
  isPublic: z.boolean().default(false).optional(),
});

type AssessmentFormValues = z.infer<typeof assessmentFormSchema>;

const ITEMS_PER_PAGE = 6;

export default function AssessmentRepositoryManager() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [userAssessments, setUserAssessments] = useState<SharedAssessmentDocument[]>([]);
  const [publicAssessments, setPublicAssessments] = useState<SharedAssessmentDocument[]>([]);
  const [isLoadingUserAssessments, setIsLoadingUserAssessments] = useState(true);
  const [isLoadingPublicAssessments, setIsLoadingPublicAssessments] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<SharedAssessmentDocument | null>(null);
  const [activeTab, setActiveTab] = useState("my-uploads");

  const [lastVisiblePublicDoc, setLastVisiblePublicDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMorePublic, setHasMorePublic] = useState(true);
  const [isLoadingMorePublic, setIsLoadingMorePublic] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<InterviewType | ''>('');
  const [filterLevel, setFilterLevel] = useState<FaangLevel | ''>('');

  const form = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentFormSchema),
    defaultValues: {
      title: "",
      assessmentType: INTERVIEW_TYPES[0].value,
      assessmentStyle: '',
      difficultyLevel: '',
      content: "",
      keywords: "",
      notes: "",
      source: "",
      isPublic: false,
    },
  });

  useEffect(() => {
    if (!user || authLoading) {
      if (!authLoading) {
        setIsLoadingUserAssessments(false);
        setIsLoadingPublicAssessments(false);
      }
      return;
    }

    setIsLoadingUserAssessments(true);
    const db = getFirestore();
    const assessmentsCol = collection(db, 'sharedAssessments');
    const userQuery = query(assessmentsCol, where("userId", "==", user.uid), orderBy('createdAt', 'desc'));

    const unsubscribeUser = onSnapshot(userQuery, (querySnapshot) => {
      const fetchedAssessments: SharedAssessmentDocument[] = [];
      querySnapshot.forEach((doc) => {
        fetchedAssessments.push({ id: doc.id, ...doc.data() } as SharedAssessmentDocument);
      });
      setUserAssessments(fetchedAssessments);
      setIsLoadingUserAssessments(false);
    }, (error) => {
      console.error("Error fetching user assessments:", error);
      toast({
        title: "Error Fetching Your Assessments",
        description: "Could not load your contributed assessments. Please try again later.",
        variant: "destructive",
      });
      setIsLoadingUserAssessments(false);
    });

    return () => unsubscribeUser();
  }, [user, authLoading, toast]);

  const fetchPublicAssessments = useCallback(async (initialFetch = false) => {
    if (!user) return;
    if (initialFetch) {
      setIsLoadingPublicAssessments(true);
      setPublicAssessments([]);
      setLastVisiblePublicDoc(null);
      setHasMorePublic(true);
    } else {
      setIsLoadingMorePublic(true);
    }

    const db = getFirestore();
    const publicAssessmentsCol = collection(db, 'sharedAssessments');
    let q = query(publicAssessmentsCol, where("isPublic", "==", true), orderBy('createdAt', 'desc'), limit(ITEMS_PER_PAGE));

    if (!initialFetch && lastVisiblePublicDoc) {
      q = query(q, startAfter(lastVisiblePublicDoc));
    }

    try {
      const querySnapshot = await getDocs(q);
      const fetchedBatch: SharedAssessmentDocument[] = [];
      querySnapshot.forEach((doc) => {
        fetchedBatch.push({ id: doc.id, ...doc.data() } as SharedAssessmentDocument);
      });

      setPublicAssessments(prev => initialFetch ? fetchedBatch : [...prev, ...fetchedBatch]);
      setLastVisiblePublicDoc(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setHasMorePublic(querySnapshot.docs.length === ITEMS_PER_PAGE);

    } catch (error) {
      console.error("Error fetching public assessments:", error);
      toast({
        title: "Error Fetching Public Assessments",
        description: "Could not load public assessments. Please try again later.",
        variant: "destructive",
      });
    } finally {
      if (initialFetch) setIsLoadingPublicAssessments(false);
      else setIsLoadingMorePublic(false);
    }
  }, [user, toast, lastVisiblePublicDoc]);

  useEffect(() => {
    if (activeTab === "public-repository" && publicAssessments.length === 0) {
      fetchPublicAssessments(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user]); // Only re-fetch initially if tab changes or user logs in

  const handleOpenForm = (assessment: SharedAssessmentDocument | null = null) => {
    setEditingAssessment(assessment);
    if (assessment) {
      form.reset({
        title: assessment.title,
        assessmentType: assessment.assessmentType,
        assessmentStyle: assessment.assessmentStyle || '',
        difficultyLevel: assessment.difficultyLevel || '',
        content: assessment.content,
        keywords: assessment.keywords?.join(', ') || '',
        notes: assessment.notes || '',
        source: assessment.source || '',
        isPublic: assessment.isPublic || false,
      });
    } else {
      form.reset({
        title: "",
        assessmentType: INTERVIEW_TYPES[0].value,
        assessmentStyle: '',
        difficultyLevel: '',
        content: "",
        keywords: "",
        notes: "",
        source: "",
        isPublic: false,
      });
    }
    setIsFormOpen(true);
  };

  const onSubmit = async (data: AssessmentFormValues) => {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    const assessmentData: Omit<SharedAssessmentDocument, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: any, updatedAt: any } = {
      userId: user.uid,
      uploaderEmail: user.email || undefined,
      title: data.title,
      assessmentType: data.assessmentType,
      assessmentStyle: data.assessmentStyle || undefined,
      difficultyLevel: data.difficultyLevel || undefined,
      content: data.content,
      keywords: data.keywords?.split(',').map(k => k.trim()).filter(k => k) || [],
      notes: data.notes || undefined,
      source: data.source || undefined,
      isPublic: data.isPublic || false,
      updatedAt: serverTimestamp(),
    };

    const db = getFirestore();
    try {
      if (editingAssessment && editingAssessment.id) {
        await setDoc(doc(db, 'sharedAssessments', editingAssessment.id), assessmentData, { merge: true });
        toast({ title: "Assessment Updated", description: "Your assessment has been successfully updated." });
      } else {
        assessmentData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'sharedAssessments'), assessmentData);
        toast({ title: "Assessment Uploaded", description: "Your assessment has been successfully added." });
      }
      setIsFormOpen(false);
      form.reset();
      if (activeTab === "public-repository" && assessmentData.isPublic) {
        fetchPublicAssessments(true); // Refresh public list
      }
    } catch (error) {
      console.error("Error saving assessment:", error);
      toast({ title: "Save Error", description: "Could not save the assessment. Please try again.", variant: "destructive" });
    }
  };

  const handleDeleteAssessment = async (assessmentId: string) => {
    if (!user) return;
    const db = getFirestore();
    try {
      await deleteDoc(doc(db, 'sharedAssessments', assessmentId));
      toast({ title: "Assessment Deleted", description: "The assessment has been successfully deleted." });
      if (activeTab === "public-repository") {
        fetchPublicAssessments(true); // Refresh public list
      }
    } catch (error) {
      console.error("Error deleting assessment:", error);
      toast({ title: "Delete Error", description: "Could not delete the assessment.", variant: "destructive" });
    }
  };

  const filteredPublicAssessments = useMemo(() => {
    return publicAssessments.filter(assessment => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (
        assessment.title.toLowerCase().includes(searchLower) ||
        assessment.content.toLowerCase().substring(0, 200).includes(searchLower) || // Search a snippet of content
        (assessment.keywords && assessment.keywords.some(kw => kw.toLowerCase().includes(searchLower)))
      );
      const matchesType = filterType ? assessment.assessmentType === filterType : true;
      const matchesLevel = filterLevel ? assessment.difficultyLevel === filterLevel : true;
      return matchesSearch && matchesType && matchesLevel;
    });
  }, [publicAssessments, searchTerm, filterType, filterLevel]);
  
  const renderAssessmentCard = (assessment: SharedAssessmentDocument, isOwner: boolean) => (
    <Card key={assessment.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg text-primary">{assessment.title}</CardTitle>
        <CardDescription className="text-xs">
          Type: {INTERVIEW_TYPES.find(t => t.value === assessment.assessmentType)?.label || assessment.assessmentType}
          {assessment.assessmentStyle && ` | Style: ${INTERVIEW_STYLES.find(s => s.value === assessment.assessmentStyle)?.label || assessment.assessmentStyle}`}
          {assessment.difficultyLevel && ` | Level: ${FAANG_LEVELS.find(l => l.value === assessment.difficultyLevel)?.label || assessment.difficultyLevel}`}
          <br />
          {assessment.uploaderEmail && `By: ${assessment.uploaderEmail} | `}
          Uploaded: {assessment.createdAt?.toDate ? assessment.createdAt.toDate().toLocaleDateString() : 'N/A'}
          {assessment.isPublic && <Badge variant="outline" className="ml-2 text-xs text-green-600 border-green-500">Public</Badge>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm flex-grow">
        <div className="line-clamp-4">
          <h4 className="font-semibold text-muted-foreground text-xs">Content Preview:</h4>
          <p className="whitespace-pre-wrap text-foreground/90 text-xs">{assessment.content}</p>
        </div>
        {assessment.keywords && assessment.keywords.length > 0 && (
          <div>
            <h4 className="font-semibold text-muted-foreground text-xs mt-2 flex items-center"><Tag className="h-3 w-3 mr-1" />Keywords:</h4>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {assessment.keywords.map(kw => <span key={kw} className="px-1.5 py-0.5 text-xs bg-secondary text-secondary-foreground rounded-full">{kw}</span>)}
            </div>
          </div>
        )}
        {assessment.source && (
           <div>
              <h4 className="font-semibold text-muted-foreground text-xs mt-2 flex items-center"><Briefcase className="h-3 w-3 mr-1" />Source:</h4>
              <p className="text-xs text-foreground/90">{assessment.source}</p>
          </div>
        )}
        {assessment.notes && (
          <div>
              <h4 className="font-semibold text-muted-foreground text-xs mt-2 flex items-center"><StickyNote className="h-3 w-3 mr-1" />Notes:</h4>
              <p className="text-xs text-foreground/90 line-clamp-2">{assessment.notes}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end space-x-2 pt-4 mt-auto">
        {/* TODO: Add a "View Full" button that opens a dialog */}
        {isOwner && (
          <>
            <Button variant="outline" size="sm" onClick={() => handleOpenForm(assessment)}>
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
                    This action cannot be undone. This will permanently delete "{assessment.title}".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDeleteAssessment(assessment.id!)}>
                    Yes, delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </CardFooter>
    </Card>
  );

  if (authLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading assessment repository...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-orange-400 mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground">Please Log In</h2>
        <p className="text-muted-foreground">You need to be logged in to manage and contribute assessments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-3xl font-bold text-primary flex items-center">
              <Library className="mr-3 h-8 w-8" /> Assessment Repository
            </CardTitle>
            <CardDescription>
              Contribute, manage, and browse interview assessments.
            </CardDescription>
          </div>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenForm(null)} className="bg-primary hover:bg-primary/90">
                <PlusCircle className="mr-2 h-5 w-5" /> Upload New Assessment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {editingAssessment ? 'Edit Assessment' : 'Upload New Assessment'}
                </DialogTitle>
                <DialogDescription>
                  {editingAssessment ? 'Update the details of your assessment.' : 'Contribute a new assessment to the repository.'}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] p-1">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4 pr-6">
                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem><FormLabel>Title *</FormLabel><FormControl><Input placeholder="e.g., Netflix PM Case: Streaming Growth" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="assessmentType" render={({ field }) => (
                      <FormItem><FormLabel>Assessment Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                          <SelectContent>{INTERVIEW_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                     <FormField control={form.control} name="assessmentStyle" render={({ field }) => (
                      <FormItem><FormLabel>Assessment Style (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select style (optional)" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {INTERVIEW_STYLES.map(style => <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>)}
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="difficultyLevel" render={({ field }) => (
                      <FormItem><FormLabel>Difficulty Level (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select level (optional)" /></SelectTrigger></FormControl>
                          <SelectContent>
                             <SelectItem value="">None</SelectItem>
                            {FAANG_LEVELS.map(level => <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>)}
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="content" render={({ field }) => (
                      <FormItem><FormLabel>Content *</FormLabel><FormControl><Textarea placeholder="Paste the full assessment text, question, or case study details here..." className="min-h-[150px]" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="keywords" render={({ field }) => (
                      <FormItem><FormLabel>Keywords/Tags (Optional)</FormLabel><FormControl><Input placeholder="e.g., product strategy, SQL, system design, python" {...field} /></FormControl><FormDescription>Comma-separated list.</FormDescription><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="source" render={({ field }) => (
                      <FormItem><FormLabel>Source (Optional)</FormLabel><FormControl><Input placeholder="e.g., From my Google interview, Company X prep doc" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem><FormLabel>Your Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Any additional notes about this assessment, why it's useful, etc." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField
                        control={form.control}
                        name="isPublic"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                            <FormControl>
                                <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>
                                Make this assessment publicly visible?
                                </FormLabel>
                                <FormDescription>
                                If checked, other logged-in users will be able to view this assessment in the "Public Repository" tab.
                                </FormDescription>
                            </div>
                            </FormItem>
                        )}
                        />
                    <DialogFooter className="pt-4">
                      <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                      <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingAssessment ? 'Save Changes' : 'Upload Assessment'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="my-uploads">My Uploads</TabsTrigger>
          <TabsTrigger value="public-repository">Public Repository</TabsTrigger>
        </TabsList>
        <TabsContent value="my-uploads">
          {isLoadingUserAssessments ? (
             <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : userAssessments.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-lg mt-6">
              <FileText className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground">No Assessments Uploaded Yet</h3>
              <p className="text-muted-foreground mt-1">Contribute your first interview assessment!</p>
              <Button onClick={() => handleOpenForm(null)} className="mt-6">
                <PlusCircle className="mr-2 h-5 w-5" /> Upload Your First Assessment
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 mt-6">
              {userAssessments.map((assessment) => renderAssessmentCard(assessment, true))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="public-repository">
          <Card className="my-4 p-4 shadow">
            <CardTitle className="text-md mb-3 flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter & Search Public Assessments</CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                placeholder="Search by title, keyword..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-sm"
              />
              <Select value={filterType} onValueChange={(value) => setFilterType(value as InterviewType | '')}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Filter by Type..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  {INTERVIEW_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterLevel} onValueChange={(value) => setFilterLevel(value as FaangLevel | '')}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Filter by Level..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Levels</SelectItem>
                  {FAANG_LEVELS.map(level => <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {isLoadingPublicAssessments && publicAssessments.length === 0 ? ( // Initial load spinner
             <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredPublicAssessments.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-lg mt-6">
              <Search className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground">No Public Assessments Found</h3>
              <p className="text-muted-foreground mt-1">No assessments match your current filters, or the repository is empty. Try adjusting your search or check back later!</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 mt-6">
                {filteredPublicAssessments.map((assessment) => renderAssessmentCard(assessment, assessment.userId === user?.uid))}
              </div>
              {hasMorePublic && !isLoadingMorePublic && (
                <div className="mt-6 text-center">
                  <Button onClick={() => fetchPublicAssessments(false)}>
                    Load More Assessments
                  </Button>
                </div>
              )}
              {isLoadingMorePublic && (
                <div className="mt-6 flex justify-center items-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Loading more...</span>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}


    
