"use client";

import { useEffect, useSyncExternalStore } from "react";
import { type LearnerSummaryState } from "./learner-snapshot";
import {
  ensureLearnerSummary,
  getLearnerSummaryState,
  getServerLearnerSummaryState,
  subscribeToLearnerSummary,
} from "./learner-store";

/** The server's render and the first paint hold `not-loaded`, so they match. */
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
