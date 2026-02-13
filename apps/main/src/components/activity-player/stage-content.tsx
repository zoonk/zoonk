"use client";

import { CompletionScreenContent } from "./completion-screen";
import { FeedbackScreenContent } from "./feedback-screen";
import { type StepResult } from "./player-reducer";

export function StageContent({
  currentResult,
  isCompleted,
  activityId,
  lessonHref,
  nextActivityHref,
  results,
  phase,
}: {
  currentResult: StepResult | undefined;
  isCompleted: boolean;
  activityId: string;
  lessonHref: string;
  nextActivityHref: string | null;
  results: Record<string, StepResult>;
  phase: string;
}) {
  if (isCompleted) {
    return (
      <CompletionScreenContent
        activityId={activityId}
        lessonHref={lessonHref}
        nextActivityHref={nextActivityHref}
        results={results}
      />
    );
  }

  if (phase === "feedback" && currentResult) {
    return <FeedbackScreenContent result={currentResult} />;
  }

  // Step content will be rendered here by step renderers (Issue 9)
  return null;
}
