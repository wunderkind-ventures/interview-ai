"use client";

import { Timer, Pause, Play, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface SessionHeaderProps {
  currentQuestion: number;
  totalQuestions: number;
  elapsedTime: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}

export default function SessionHeader({
  currentQuestion,
  totalQuestions,
  elapsedTime,
  isPaused,
  onPause,
  onResume,
  onEnd,
}: SessionHeaderProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const progress = (currentQuestion / totalQuestions) * 100;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(progress), 100);
    return () => clearTimeout(timer);
  }, [progress]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Progress Info */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                Question {currentQuestion} of {totalQuestions}
              </span>
              <span className="text-sm text-muted-foreground">
                {Math.round(progress)}% Complete
              </span>
            </div>
            <Progress value={animatedProgress} className="h-2" />
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <Timer className={cn("h-4 w-4", isPaused && "text-muted-foreground")} />
            <span className={cn("font-mono text-sm", isPaused && "text-muted-foreground")}>
              {formatTime(elapsedTime)}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={isPaused ? onResume : onPause}
            >
              {isPaused ? (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onEnd}
            >
              <Flag className="h-4 w-4 mr-1" />
              End
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}