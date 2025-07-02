"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Brain, 
  MessageSquare, 
  FileText, 
  TrendingUp, 
  Users, 
  Zap,
  Target,
  BarChart3,
  Shield
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Interviews",
    description: "Practice with intelligent AI that adapts to your responses and provides personalized feedback.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: MessageSquare,
    title: "Multiple Interview Styles",
    description: "From behavioral to technical system design, practice all types of interviews you'll face.",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    icon: FileText,
    title: "Resume Lab",
    description: "Optimize your resume with AI analysis and get tailored suggestions for improvement.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description: "Monitor your improvement with detailed analytics and performance insights.",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    icon: Target,
    title: "FAANG-Level Standards",
    description: "Practice with questions and evaluation criteria used by top tech companies.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: Shield,
    title: "Personalized Coaching",
    description: "Get specific advice based on your background, target role, and interview performance.",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
];

export default function FeatureCards() {
  return (
    <section className="py-20 sm:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Everything You Need to{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Succeed
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="mt-4 text-lg text-muted-foreground"
          >
            Comprehensive interview preparation tools designed to help you land your dream job
          </motion.p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="group relative overflow-hidden border-muted hover:border-primary/50 transition-all duration-300">
                {/* Hover effect gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <CardHeader className="relative">
                  <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ${feature.bgColor}`}>
                    <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Additional benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mt-16 rounded-2xl bg-muted/50 p-8 sm:p-12"
        >
          <div className="mx-auto max-w-3xl text-center">
            <h3 className="text-2xl font-bold mb-4">Why Choose InterviewAI?</h3>
            <div className="grid gap-6 sm:grid-cols-3 mt-8">
              <div className="flex flex-col items-center">
                <Zap className="h-8 w-8 text-primary mb-2" />
                <h4 className="font-semibold">Instant Feedback</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Get real-time evaluation and suggestions
                </p>
              </div>
              <div className="flex flex-col items-center">
                <Users className="h-8 w-8 text-accent mb-2" />
                <h4 className="font-semibold">Expert-Designed</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Questions from industry professionals
                </p>
              </div>
              <div className="flex flex-col items-center">
                <BarChart3 className="h-8 w-8 text-primary mb-2" />
                <h4 className="font-semibold">Track Progress</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Measure improvement over time
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}