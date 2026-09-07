"use client";

import { useMemo } from "react";
import { type PlayerQuestionContext, usePlayerRuntime } from "./player-context";
import { getCurrentStep } from "./player-selectors";

export function usePlayerQuestionContext(): PlayerQuestionContext {
  const { state } = usePlayerRuntime();
  const step = getCurrentStep(state);
  const stepIndex = state.currentStepIndex;
  const isComplete = state.phase === "completed";

  return useMemo(
    () => (isComplete || !step ? { kind: "lesson" } : { kind: "step", step, stepIndex }),
    [isComplete, step, stepIndex],
  );
}
