"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { type LearnerSummaryState } from "./learner-snapshot";
import {
  ensureLearnerSummary,
  getLearnerSummaryState,
  getServerLearnerSummaryState,
  onLearnerIdentityChange,
  subscribeToLearnerSummary,
} from "./learner-store";

/**
 * The learner summary for a component that shows it, read when it isn't yet: the server's render
 * and the first paint hold `not-loaded`, so they match.
 */
export function useLearnerSummary(): LearnerSummaryState {
  const state = useSyncExternalStore(
    subscribeToLearnerSummary,
    getLearnerSummaryState,
    getServerLearnerSummaryState,
  );

  useEffect(() => {
    ensureLearnerSummary();
  }, []);

  return state;
}

/**
 * Reads the page again when the learner it showed signed out or another took the session (in
 * another tab), so nothing of theirs stays on screen.
 */
export function useRefreshOnLearnerChange(): void {
  const router = useRouter();

  useEffect(() => onLearnerIdentityChange(() => router.refresh()), [router]);
}
