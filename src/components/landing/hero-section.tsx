"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Users, Trophy, Brain } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { motion } from "framer-motion";

export default function HeroSection() {
  const { user, signInWithGoogle } = useAuth();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-background/80 py-20 sm:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-[600px] w-[600px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          {/* Animated badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
          >
            <Sparkles className="h-4 w-4" />
            <span>AI-Powered Interview Preparation</span>
          </motion.div>

          {/* Main heading with gradient */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
          >
            Ace Your{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Tech Interview
            </span>{" "}
            with Confidence
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-10 text-lg text-muted-foreground sm:text-xl"
          >
            Practice with AI interviewers tailored to FAANG standards. Get instant feedback,
            track your progress, and land your dream job.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col gap-4 sm:flex-row sm:justify-center"
          >
            {user ? (
              <Link href="/interview-setup">
                <Button size="lg" className="group">
                  Start Mock Interview
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/demo">
                  <Button size="lg" className="group">
                    Try Free Demo
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" onClick={signInWithGoogle}>
                  Sign In with Google
                </Button>
              </>
            )}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3"
          >
            <div className="flex flex-col items-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="text-2xl font-bold">10,000+</div>
              <div className="text-sm text-muted-foreground">Active Users</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                <Trophy className="h-6 w-6 text-accent" />
              </div>
              <div className="text-2xl font-bold">85%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div className="text-2xl font-bold">50K+</div>
              <div className="text-sm text-muted-foreground">Practice Sessions</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}