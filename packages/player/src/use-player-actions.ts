"use client";

import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { type Dispatch, useCallback } from "react";
import { checkStep } from "./check-step";
import { buildCompletionInput, getPlayerTransition } from "./player-controller";
import {
  type PlayerAction,
  type PlayerState,
  type SelectedAnswer,
  type playerReducer,
} from "./player-reducer";
import { getPlayerCheckBehavior } from "./player-step-behavior";

export type PlayerActions = {
  check: () => void;
  continue: () => void;
  navigateNext: () => void;
  navigatePrev: () => void;
  restart: () => void;
  selectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
};

const READ_ONLY_CHECK_RESULT = {
  result: { correctAnswer: null, feedback: null, isCorrect: true },
} as const;

export function usePlayerActions(
  state: PlayerState,
  dispatch: Dispatch<Parameters<typeof playerReducer>[1]>,
  onComplete: (input: CompletionInput) => void,
  isAuthenticated: boolean,
) {
  const currentStep = state.steps[state.currentStepIndex];

  const dispatchTransition = useCallback(
    (action: PlayerAction) => {
      const transition = getPlayerTransition(state, action);
      dispatch(action);

      if (transition.shouldPersistCompletion && isAuthenticated) {
        onComplete(buildCompletionInput(transition.nextState));
      }
    },
    [dispatch, isAuthenticated, onComplete, state],
  );

  const selectAnswer = useCallback(
    (stepId: string, answer: SelectedAnswer | null) => {
      if (!answer) {
        dispatchTransition({ stepId, type: "CLEAR_ANSWER" });
        return;
      }

      dispatchTransition({ answer, stepId, type: "SELECT_ANSWER" });
    },
    [dispatchTransition],
  );

  const check = useCallback(() => {
    if (!currentStep) {
      return;
    }

    if (getPlayerCheckBehavior(currentStep) === "investigationProblem") {
      dispatchTransition({
        result: READ_ONLY_CHECK_RESULT.result,
        stepId: currentStep.id,
        type: "CHECK_ANSWER",
      });
      return;
    }

    const answer = state.selectedAnswers[currentStep.id];

    if (!answer) {
      return;
    }

    const { result } = checkStep(currentStep, answer);
    dispatchTransition({ result, stepId: currentStep.id, type: "CHECK_ANSWER" });
  }, [currentStep, dispatchTransition, state.selectedAnswers]);

  const handleContinue = useCallback(() => {
    dispatchTransition({ type: "CONTINUE" });
  }, [dispatchTransition]);

  const navigateNext = useCallback(() => {
    dispatchTransition({ direction: "next", type: "NAVIGATE_STEP" });
  }, [dispatchTransition]);

  const navigatePrev = useCallback(() => {
    dispatchTransition({ direction: "prev", type: "NAVIGATE_STEP" });
  }, [dispatchTransition]);

  const restart = useCallback(() => {
    dispatchTransition({ type: "RESTART" });
  }, [dispatchTransition]);

  return {
    check,
    continue: handleContinue,
    navigateNext,
    navigatePrev,
    restart,
    selectAnswer,
  };
}
