"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Mic, 
  MicOff, 
  Send, 
  RotateCcw,
  Timer,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  answerTime: number;
  isRecording: boolean;
  onToggleRecording: () => void;
  minLength?: number;
  maxLength?: number;
}

export default function AnswerInput({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  answerTime,
  isRecording,
  onToggleRecording,
  minLength = 50,
  maxLength = 2000,
}: AnswerInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const wordCount = value.trim().split(/\s+/).filter(word => word.length > 0).length;
  const charCount = value.length;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      if (value.trim().length >= minLength && !isSubmitting) {
        onSubmit();
      }
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 400)}px`;
    }
  }, [value]);

  return (
    <Card className={cn(
      "transition-all duration-300",
      isFocused && "ring-2 ring-primary ring-offset-2"
    )}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Your Answer</CardTitle>
          <div className="flex items-center gap-3">
            {/* Timer */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Timer className="h-4 w-4" />
              <span className="font-mono">{formatTime(answerTime)}</span>
            </div>
            
            {/* Recording Status */}
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Badge variant="destructive" className="gap-1">
                    <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    Recording
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer here... Be specific and use examples where possible."
            className="min-h-[150px] resize-none pr-12"
            disabled={isSubmitting}
          />
          
          {/* Voice Recording Button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2"
            onClick={onToggleRecording}
            disabled={isSubmitting}
          >
            {isRecording ? (
              <MicOff className="h-4 w-4 text-destructive" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Character/Word Count */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className={cn(
              "text-muted-foreground",
              charCount < minLength && "text-destructive",
              charCount > maxLength && "text-destructive"
            )}>
              {charCount} / {maxLength} characters
            </span>
            <span className="text-muted-foreground">
              {wordCount} words
            </span>
          </div>
          
          {charCount < minLength && (
            <div className="flex items-center gap-1 text-destructive text-xs">
              <AlertCircle className="h-3 w-3" />
              <span>Minimum {minLength} characters required</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            disabled={isSubmitting || !value}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Clear
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Press <kbd className="px-1 py-0.5 text-xs bg-muted rounded">⌘</kbd> + <kbd className="px-1 py-0.5 text-xs bg-muted rounded">Enter</kbd> to submit
            </span>
            <Button
              onClick={onSubmit}
              disabled={isSubmitting || charCount < minLength || charCount > maxLength}
              className="min-w-[100px]"
            >
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit
                  <Send className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}