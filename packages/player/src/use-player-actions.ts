"use client";

import {
  type CompletionInput,
  type CompletionResult,
} from "@zoonk/core/player/contracts/completion-input-schema";
import { type Dispatch, useCallback, useRef, useState } from "react";
import { checkStep } from "./check-step";
import {
  rememberCompletionMilestones,
  rememberCompletionProgress,
} from "./completion-milestone-storage";
import {
  getCompletionMilestones,
  getInitialCompletionMilestoneIndex,
} from "./completion-milestones";
import {
  type CompletionPersistence,
  type PlayerCompletionHandler,
  type PlayerCompletionOutcome,
} from "./completion-persistence";
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
  retryCompletion: () => void;
  selectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
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
    lessonDurationSeconds: state.completion.lessonDurationSeconds,
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
  onComplete: PlayerCompletionHandler;
  onStepChange?: (event: PlayerStepChangeEvent) => void;
  state: PlayerState;
}) {
  const currentStep = state.steps[state.currentStepIndex];
  const [completionPersistence, setCompletionPersistence] = useState<CompletionPersistence>("idle");
  const pendingCompletion = useRef<{ input: CompletionInput; state: PlayerState } | null>(null);
  const saving = useRef(false);

  const finishPersistence = useCallback(
    (outcome: PlayerCompletionOutcome | undefined) => {
      saving.current = false;
      const pending = pendingCompletion.current;

      if (!pending) {
        return;
      }

      if (outcome && outcome.status !== "completed") {
        setCompletionPersistence(outcome.status);
        return;
      }

      const completedState = confirmCompletion(pending.state, outcome?.result);
      rememberCompletedStateMilestones(completedState);
      dispatch({ state: completedState, type: "CONFIRM_COMPLETION" });
      pendingCompletion.current = null;
      setCompletionPersistence("idle");
    },
    [dispatch],
  );

  const persistCompletion = useCallback(() => {
    if (saving.current || !pendingCompletion.current) {
      return;
    }

    saving.current = true;
    setCompletionPersistence("saving");

    try {
      const outcome = onComplete(pendingCompletion.current.input);

      if (outcome instanceof Promise) {
        void outcome.then(finishPersistence).catch(() => finishPersistence({ status: "failed" }));
      } else {
        finishPersistence(outcome ?? undefined);
      }
    } catch {
      finishPersistence({ status: "failed" });
    }
  }, [finishPersistence, onComplete]);

  const dispatchTransition = useCallback(
    (action: PlayerAction) => {
      if (pendingCompletion.current) {
        return;
      }

      const transition = getPlayerTransition(state, action);

      if (transition.shouldPersistCompletion) {
        pendingCompletion.current = {
          input: buildCompletionInput({ state: transition.nextState }),
          state: transition.nextState,
        };

        persistCompletion();
        return;
      }

      dispatch(action);
      const stepChangeEvent = getPlayerStepChangeEvent({ nextState: transition.nextState, state });

      if (stepChangeEvent) {
        onStepChange?.(stepChangeEvent);
      }
    },
    [dispatch, onStepChange, persistCompletion, state],
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

  return {
    check,
    completionPersistence,
    continue: handleContinue,
    navigateNext,
    navigatePrev,
    restart,
    retryCompletion: persistCompletion,
    selectAnswer,
  };
}

/** The captured timing stays stable through a retry while rewards come from the persisted receipt. */
function confirmCompletion(state: PlayerState, result?: CompletionResult): PlayerState {
  const completion =
    state.completion && result ? { ...state.completion, ...result } : state.completion;

  if (!completion) {
    return state;
  }

  return {
    ...state,
    completion,
    completionMilestoneIndex: getInitialCompletionMilestoneIndex({
      completion,
      lessonDurationSeconds: completion?.lessonDurationSeconds,
      localDate: state.localDate,
      previousTotalBrainPower: state.totalBrainPower,
      progressSnapshot: state.progressSnapshot,
      shownMilestoneKeys: state.shownCompletionMilestoneKeys,
    }),
  };
}
