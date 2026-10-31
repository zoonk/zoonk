"use client";

import { type LearnerSummaryState } from "@/lib/learner/learner-snapshot";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";

export function hasAccount(learner: LearnerSummaryState): boolean {
  return learner.status === "ready" && !learner.summary.identity.isAnonymous;
}

export function NoAccountNote({ children }: { children: ReactNode }) {
  return hasAccount(useLearnerSummary()) ? null : children;
}

/** A guest never reads it either: a guest's one goal can be taken, and the start then asks for an account. */
export function NoAccountStartNote({ children }: { children: ReactNode }) {
  const learner = useLearnerSummary();
  const known = learner.status === "ready" || learner.status === "visitor";

  return (
    <span
      className={cn(learner.status === "ready" && "invisible", !known && "signed-in:invisible")}
    >
      {children}
    </span>
  );
}

/**
 * Only for a visitor: a guest's free lessons run out. Kept on one line, so a narrow panel never
 * breaks it at its hyphen ("sign- / up").
 */
export function NoSessionNote({ children }: { children: ReactNode }) {
  const learner = useLearnerSummary();

  return (
    <span
      className={cn(
        "whitespace-nowrap",
        learner.status === "ready" ? "hidden" : "signed-in:hidden",
      )}
    >
      {children}
    </span>
  );
}
