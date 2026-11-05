"use client";

import { useState, useTransition } from "react";

/** On "started", the host has already opened it, or the learner went elsewhere before it could. */
export type AreaPracticeOutcome = "dailyLimit" | "failed" | "nothingToPractice" | "started";

export function usePracticeRun(run: () => Promise<AreaPracticeOutcome>) {
  const [outcome, setOutcome] = useState<AreaPracticeOutcome | null>(null);
  const [isPending, startTransition] = useTransition();

  const practice = () => {
    startTransition(async () => {
      setOutcome(await run());
    });
  };

  return { isPending, outcome, practice };
}
