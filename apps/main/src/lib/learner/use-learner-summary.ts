"use client";

import { useEffect, useSyncExternalStore } from "react";
import { type LearnerSummaryState } from "./learner-snapshot";
import {
  ensureLearnerSummary,
  getLearnerSummaryState,
  getServerLearnerSummaryState,
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
