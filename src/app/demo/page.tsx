"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, Info, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { INTERVIEW_TYPES, FAANG_LEVELS } from "@/lib/constants";
import Link from "next/link";
import { motion } from "framer-motion";

export default function DemoPage() {
  const router = useRouter();
  const [interviewType, setInterviewType] = useState("product_sense");
  const [level, setLevel] = useState("L4");
  const [isLoading, setIsLoading] = useState(false);

  const handleStartDemo = () => {
    setIsLoading(true);
    // Store demo settings in sessionStorage
    sessionStorage.setItem("demoSettings", JSON.stringify({
      interviewType,
      level,
      isDemo: true,
    }));
    router.push("/interview/demo");
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-4">
          <Sparkles className="h-4 w-4" />
          <span>Free Demo - No Account Required</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Try InterviewAI{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Risk-Free
          </span>
        </h1>
        <p className="text-lg text-muted-foreground">
          Experience our AI-powered mock interviews before creating an account
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Configure Your Demo Interview</CardTitle>
            <CardDescription>
              Choose your interview type and level to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Interview Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Interview Type</label>
              <Select value={interviewType} onValueChange={setInterviewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Level */}
            <div className="space-y-2">
              <label className="text-sm font-medium">FAANG Level</label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAANG_LEVELS.map((lvl) => (
                    <SelectItem key={lvl.value} value={lvl.value}>
                      <div>
                        <div className="font-medium">{lvl.label}</div>
                        <div className="text-xs text-muted-foreground">{lvl.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Demo Limitations Alert */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Demo Limitations:</strong> You'll experience 3 interview questions with AI feedback. 
                Create a free account to unlock full interviews, progress tracking, and personalized coaching.
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={handleStartDemo} 
                disabled={isLoading}
                className="flex-1 group"
              >
                {isLoading ? "Starting Demo..." : "Start Demo Interview"}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Link href="/interview-setup" className="flex-1">
                <Button variant="outline" className="w-full">
                  Sign In for Full Access
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Feature comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>What's Included</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold mb-3 text-muted-foreground">Demo Version</h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span>3 sample interview questions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span>Basic AI feedback</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span>Experience the interface</span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3 text-primary">Full Version (Free Account)</h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    <span>Unlimited interview sessions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    <span>Detailed performance analytics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    <span>Resume optimization tools</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    <span>Progress tracking & achievements</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    <span>Personalized coaching insights</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}