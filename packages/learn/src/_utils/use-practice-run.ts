"use client";

import { useState, useTransition } from "react";

/** How a bonus practice went; on "started" the host has already opened it. */
export type AreaPracticeOutcome = "dailyCap" | "failed" | "nothingToPractice" | "started";

/**
 * Runs a host's bonus practice action ("Practice", "Review") once at a time and keeps how it
 * went, so the button can say why nothing opened. On "started" the host has already opened it.
 */
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
