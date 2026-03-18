"use client";

import { type Dispatch, useCallback } from "react";
import { checkStep } from "./check-step";
import { type CompletionInput, type CompletionResult } from "./completion-input-schema";
import {
  buildCompletionInput,
  getPlayerTransition,
  getSubmitCompletionRequestId,
} from "./player-controller";
import {
  type PlayerAction,
  type PlayerState,
  type SelectedAnswer,
  type playerReducer,
} from "./player-reducer";

type SyncPlayerAction = Exclude<
  PlayerAction,
  { type: "REJECT_COMPLETION" | "RESOLVE_COMPLETION" | "SUBMIT_COMPLETION" }
>;

export type PlayerActions = {
  check: () => void;
  continue: () => void;
  navigateNext: () => void;
  navigatePrev: () => void;
  restart: () => void;
  selectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  startChallenge: () => void;
};

export function usePlayerActions(
  state: PlayerState,
  dispatch: Dispatch<Parameters<typeof playerReducer>[1]>,
  onComplete: (input: CompletionInput) => Promise<CompletionResult>,
  isAuthenticated: boolean,
) {
  const currentStep = state.steps[state.currentStepIndex];

  const submitCompletion = useCallback(
    (completionState: PlayerState) => {
      const requestId = getSubmitCompletionRequestId(state);
      dispatch({ requestId, type: "SUBMIT_COMPLETION" });

      void onComplete(buildCompletionInput(completionState))
        .then((result) => {
          dispatch({ requestId, result, type: "RESOLVE_COMPLETION" });
        })
        .catch(() => {
          dispatch({ requestId, type: "REJECT_COMPLETION" });
        });
    },
    [dispatch, onComplete, state],
  );

  const dispatchTransition = useCallback(
    (action: SyncPlayerAction) => {
      const transition = getPlayerTransition(state, action);
      dispatch(action);

      if (transition.shouldSubmitCompletion && isAuthenticated) {
        submitCompletion(transition.nextState);
      }
    },
    [dispatch, isAuthenticated, state, submitCompletion],
  );

  const selectAnswer = useCallback(
    (stepId: string, answer: SelectedAnswer | null) => {
      if (answer) {
        dispatchTransition({ answer, stepId, type: "SELECT_ANSWER" });
        return;
      }

      dispatchTransition({ stepId, type: "CLEAR_ANSWER" });
    },
    [dispatchTransition],
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
    dispatchTransition({ effects, result, stepId: currentStep.id, type: "CHECK_ANSWER" });
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

  const startChallenge = useCallback(() => {
    dispatchTransition({ type: "START_CHALLENGE" });
  }, [dispatchTransition]);

  return {
    check,
    continue: handleContinue,
    navigateNext,
    navigatePrev,
    restart,
    selectAnswer,
    startChallenge,
  };
}
