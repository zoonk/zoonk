"use client";

import { OnDemandWaitContext } from "@zoonk/ui/lib/on-demand";
import { useState } from "react";
import { type LessonQuestionController } from "./use-lesson-questions";

/**
 * Holds a thread's first answers in the Suspense fallback above until their renderer loads, so they
 * never show as raw Markdown; answers that arrive later draw as it loads.
 */
export function WaitForFirstShow({
  children,
  questions,
}: {
  children: React.ReactNode;
  questions: LessonQuestionController["state"]["questions"];
}) {
  const [firstQuestions, setFirstQuestions] = useState<typeof questions | null>(questions);

  if (firstQuestions && firstQuestions !== questions) {
    setFirstQuestions(null);
  }

  return <OnDemandWaitContext value={firstQuestions === questions}>{children}</OnDemandWaitContext>;
}
