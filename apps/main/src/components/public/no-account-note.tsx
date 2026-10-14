"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { type ReactNode } from "react";

/**
 * What a page shows only to people without an account yet, a visitor or a guest: a note such as
 * "Start free, no account needed.", or the bar's Pricing and Log in. The page is the same for
 * everyone, so it's there from the first paint and leaves once the learner summary finds an account.
 */
export function NoAccountNote({ children }: { children: ReactNode }) {
  const learner = useLearnerSummary();
  const hasAccount = learner.status === "ready" && !learner.summary.identity.isAnonymous;

  return hasAccount ? null : children;
}
