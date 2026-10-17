"use client";

import { type LearnerSummaryState } from "@/lib/learner/learner-snapshot";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";

/** Whether the learner summary found an account (a guest's session has none). */
export function hasAccount(learner: LearnerSummaryState): boolean {
  return learner.status === "ready" && !learner.summary.identity.isAnonymous;
}

/**
 * What a page shows only to people without an account yet, a visitor or a guest: the bar's Pricing
 * and Log in, or a note such as "Start free, no account needed.". The page is the same for
 * everyone, so it's there from the first paint and leaves once the learner summary finds an account.
 */
export function NoAccountNote({ children }: { children: ReactNode }) {
  return hasAccount(useLearnerSummary()) ? null : children;
}

/**
 * A start's line for people without an account yet ("Start free, no account needed."), in the
 * room it keeps for everyone so nothing under it moves when the learner summary arrives. A page the
 * session hint marks signed in (`signed-in:`) waits with it hidden until the summary says whether
 * the session has an account (a guest's hasn't); an account keeps it hidden, its line still held.
 */
export function NoAccountStartNote({ children }: { children: ReactNode }) {
  const learner = useLearnerSummary();
  const known = learner.status === "ready" || learner.status === "visitor";

  return (
    <span className={cn(hasAccount(learner) && "invisible", !known && "signed-in:invisible")}>
      {children}
    </span>
  );
}
