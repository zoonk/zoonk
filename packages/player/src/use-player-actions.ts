"use client";

import { useAuthState } from "@zoonk/core/auth/hooks/auth-state";
import { type Dispatch, useCallback, useState } from "react";
import { checkStep } from "./check-step";
import { type CompletionInput, type CompletionResult } from "./completion-input-schema";
import { type PlayerState, type SelectedAnswer, playerReducer } from "./player-reducer";

function willComplete(state: PlayerState): boolean {
  if (state.phase === "feedback") {
    return state.currentStepIndex + 1 >= state.steps.length;
  }

  if (state.phase === "playing") {
    const currentStep = state.steps[state.currentStepIndex];

    if (currentStep?.kind === "static") {
      return state.currentStepIndex + 1 >= state.steps.length;
    }

    if (currentStep?.kind === "matchColumns") {
      return state.currentStepIndex + 1 >= state.steps.length;
    }
  }

  return false;
}

export function usePlayerActions(
  state: PlayerState,
  dispatch: Dispatch<Parameters<typeof playerReducer>[1]>,
  onComplete: (input: CompletionInput) => Promise<CompletionResult>,
) {
  const authState = useAuthState();
  const [completionResult, setCompletionResult] = useState<CompletionResult | null>(null);
  const currentStep = state.steps[state.currentStepIndex];

  const fireCompletion = useCallback(
    (completionState: PlayerState) => {
      void onComplete({
        activityId: completionState.activityId,
        answers: completionState.selectedAnswers,
        dimensions: completionState.dimensions,
        startedAt: completionState.startedAt,
        stepTimings: completionState.stepTimings,
      })
        .then((result) => {
          setCompletionResult(result);
        })
        .catch(() => {
          setCompletionResult({ status: "error" });
        });
    },
    [onComplete],
  );

  const selectAnswer = useCallback(
    (stepId: string, answer: SelectedAnswer | null) => {
      if (answer) {
        dispatch({ answer, stepId, type: "SELECT_ANSWER" });
      } else {
        dispatch({ stepId, type: "CLEAR_ANSWER" });
      }
    },
    [dispatch],
  );

  const check = useCallback(() => {
    if (!currentStep) {
      return;
    }

    const answer = state.selectedAnswers[currentStep.id];

    if (!answer) {
      return;
    }

    const { effects, result } = checkStep(currentStep, answer);
    const matchColumnsWillComplete = currentStep.kind === "matchColumns" && willComplete(state);

    const action = { effects, result, stepId: currentStep.id, type: "CHECK_ANSWER" as const };
    dispatch(action);

    if (matchColumnsWillComplete && authState === "authenticated") {
      fireCompletion(playerReducer(state, action));
    }
  }, [currentStep, state, dispatch, authState, fireCompletion]);

  const handleContinue = useCallback(() => {
    const completing = willComplete(state);
    dispatch({ type: "CONTINUE" });

    if (completing && authState === "authenticated") {
      fireCompletion(state);
    }
  }, [state, dispatch, authState, fireCompletion]);

  const navigateNext = useCallback(() => {
    const completing = willComplete(state);
    dispatch({ direction: "next", type: "NAVIGATE_STEP" });

    if (completing && authState === "authenticated") {
      fireCompletion(state);
    }
  }, [state, dispatch, authState, fireCompletion]);

  const navigatePrev = useCallback(() => {
    dispatch({ direction: "prev", type: "NAVIGATE_STEP" });
  }, [dispatch]);

  const restart = useCallback(() => {
    setCompletionResult(null);
    dispatch({ type: "RESTART" });
  }, [dispatch]);

  const startChallenge = useCallback(() => {
    dispatch({ type: "START_CHALLENGE" });
  }, [dispatch]);

  return {
    check,
    completionResult,
    continue: handleContinue,
    navigateNext,
    navigatePrev,
    restart,
    selectAnswer,
    startChallenge,
  };
}
