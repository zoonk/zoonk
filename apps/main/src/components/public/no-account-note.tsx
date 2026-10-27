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
 * A start's line for a visitor ("Start free, no account needed."), in the room it keeps for
 * everyone so nothing under it moves when the learner summary arrives. A guest, like an account,
 * never reads it: a guest's one goal can be taken, and the start then asks for an account. A page
 * the session hint marks signed in (`signed-in:`) waits with it hidden until the summary arrives;
 * any session keeps it hidden, its line still held.
 */
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
 * A lesson's "No sign-up needed.", only for a visitor: a guest's free lessons run out, and their
 * next lesson then asks for an account, so a guest, like an account, never reads it. Hidden from
 * the first paint on a page the session hint marks signed in, and once the learner summary finds a
 * session. The short sentence stays on one line, so a narrow panel moves it whole to the next line
 * instead of breaking it at its hyphen ("sign- / up").
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
