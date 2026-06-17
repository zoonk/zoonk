"use client";

import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { type Dispatch, useCallback } from "react";
import { checkStep } from "./check-step";
import {
  rememberCompletionMilestones,
  rememberCompletionProgress,
} from "./completion-milestone-storage";
import { getCompletionMilestones } from "./completion-milestones";
import { buildCompletionInput, getPlayerTransition } from "./player-controller";
import { type PlayerStepChangeEvent, getPlayerStepChangeEvent } from "./player-events";
import {
  type PlayerAction,
  type PlayerState,
  type SelectedAnswer,
  type playerReducer,
} from "./player-reducer";

export type PlayerActions = {
  check: () => void;
  continue: () => void;
  navigateNext: () => void;
  navigatePrev: () => void;
  restart: () => void;
  selectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  start: () => void;
};

/**
 * Stores the milestones that this completion will show so later prefetched
 * lesson pages do not repeat the same milestone from an older progress snapshot.
 */
function rememberCompletedStateMilestones(state: PlayerState) {
  if (!state.completion) {
    return;
  }

  const milestones = getCompletionMilestones({
    completion: state.completion,
    localDate: state.localDate,
    previousTotalBrainPower: state.totalBrainPower,
    progressSnapshot: state.progressSnapshot,
    shownMilestoneKeys: state.shownCompletionMilestoneKeys,
  });

  rememberCompletionMilestones({ localDate: state.localDate, milestones });

  rememberCompletionProgress({
    completion: state.completion,
    localDate: state.localDate,
    progressSnapshot: state.progressSnapshot,
  });
}

/**
 * Owns reducer dispatch side effects so host apps can react to semantic player
 * events without needing to inspect reducer states themselves.
 */
export function usePlayerActions({
  dispatch,
  onComplete,
  onStepChange,
  state,
}: {
  dispatch: Dispatch<Parameters<typeof playerReducer>[1]>;
  onComplete: (input: CompletionInput) => void;
  onStepChange?: (event: PlayerStepChangeEvent) => void;
  state: PlayerState;
}) {
  const currentStep = state.steps[state.currentStepIndex];

  const dispatchTransition = useCallback(
    (action: PlayerAction) => {
      const transition = getPlayerTransition(state, action);
      dispatch(action);

      if (transition.shouldPersistCompletion) {
        rememberCompletedStateMilestones(transition.nextState);
        onComplete(buildCompletionInput(transition.nextState));
      }

      const stepChangeEvent = getPlayerStepChangeEvent({ nextState: transition.nextState, state });

      if (stepChangeEvent) {
        onStepChange?.(stepChangeEvent);
      }
    },
    [dispatch, onComplete, onStepChange, state],
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

  const start = useCallback(() => {
    dispatchTransition({ type: "START" });
  }, [dispatchTransition]);

  return {
    check,
    continue: handleContinue,
    navigateNext,
    navigatePrev,
    restart,
    selectAnswer,
    start,
  };
}
