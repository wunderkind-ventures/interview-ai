"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  Code2, 
  MessageSquare, 
  Target,
  Lightbulb,
  BookOpen,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import type { InterviewQuestion } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuestionCardProps {
  question: InterviewQuestion;
  questionNumber: number;
  onGetHint: () => void;
  onGetSampleAnswer: () => void;
  onClarifyQuestion: () => void;
  isGettingHint: boolean;
  isGettingSample: boolean;
  isClarifying: boolean;
}

const questionTypeIcons = {
  behavioral: MessageSquare,
  technical: Code2,
  system_design: Brain,
  product: Target,
};

export default function QuestionCard({
  question,
  questionNumber,
  onGetHint,
  onGetSampleAnswer,
  onClarifyQuestion,
  isGettingHint,
  isGettingSample,
  isClarifying,
}: QuestionCardProps) {
  const Icon = questionTypeIcons[question.type] || MessageSquare;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Question {questionNumber}</CardTitle>
                  <CardDescription className="text-xs">
                    {question.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    {question.difficulty && (
                      <Badge variant="outline" className="ml-2">
                        {question.difficulty}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
            </div>
            
            {/* Help Actions */}
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClarifyQuestion}
                      disabled={isClarifying}
                    >
                      {isClarifying ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <HelpCircle className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clarify Question</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onGetHint}
                      disabled={isGettingHint}
                    >
                      {isGettingHint ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Lightbulb className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Get Hint</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onGetSampleAnswer}
                      disabled={isGettingSample}
                    >
                      {isGettingSample ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <BookOpen className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sample Answer</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-slate max-w-none">
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {question.question}
            </p>
          </div>

          {/* Additional Context */}
          {question.context && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Context:</strong> {question.context}
              </p>
            </div>
          )}

          {/* Follow-up Questions */}
          {question.followUpQuestions && question.followUpQuestions.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Be prepared to discuss:
              </p>
              <ul className="space-y-1">
                {question.followUpQuestions.map((followUp, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{followUp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}