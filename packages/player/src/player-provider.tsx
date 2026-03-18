"use client";

import { useCallback, useMemo, useReducer } from "react";
import { type CompletionInput, type CompletionResult } from "./completion-input-schema";
import {
  PlayerConfigContext,
  type PlayerMilestone,
  type PlayerNavigation,
  PlayerRuntimeContext,
  type PlayerViewer,
} from "./player-context";
import { createInitialState, playerReducer } from "./player-reducer";
import {
  getCanNavigatePrev,
  getHasAnswer,
  getIsGameOver,
  getIsStaticStep,
} from "./player-selectors";
import { type SerializedActivity } from "./prepare-activity-data";
import { usePlayerActions } from "./use-player-actions";
import { usePlayerKeyboard } from "./use-player-keyboard";
import { UserNameProvider } from "./user-name-context";

export function PlayerProvider({
  activity,
  children,
  milestone,
  navigation,
  onComplete,
  onEscape,
  onNext,
  viewer,
}: {
  activity: SerializedActivity;
  children: React.ReactNode;
  milestone: PlayerMilestone;
  navigation: PlayerNavigation;
  onComplete: (input: CompletionInput) => Promise<CompletionResult>;
  onEscape: () => void;
  onNext?: () => void;
  viewer: PlayerViewer;
}) {
  const [state, dispatch] = useReducer(playerReducer, activity, createInitialState);
  const actions = usePlayerActions(state, dispatch, onComplete, viewer.isAuthenticated);

  const handleNext = useCallback(() => {
    onNext?.();
  }, [onNext]);

  usePlayerKeyboard({
    canNavigatePrev: getCanNavigatePrev(state),
    hasAnswer: getHasAnswer(state),
    isStaticStep: getIsStaticStep(state),
    onCheck: actions.check,
    onContinue: actions.continue,
    onEscape,
    onNavigateNext: actions.navigateNext,
    onNavigatePrev: actions.navigatePrev,
    onNext: onNext && !getIsGameOver(state) ? handleNext : null,
    onRestart: actions.restart,
    onStartChallenge: state.phase === "intro" ? actions.startChallenge : null,
    phase: state.phase,
  });

  const configValue = useMemo(
    () => ({
      escape: onEscape,
      milestone,
      navigation,
      next: handleNext,
      viewer,
    }),
    [handleNext, milestone, navigation, onEscape, viewer],
  );

  const runtimeValue = useMemo(
    () => ({
      actions,
      state,
    }),
    [actions, state],
  );

  return (
    <PlayerConfigContext value={configValue}>
      <PlayerRuntimeContext value={runtimeValue}>
        <UserNameProvider initialName={viewer.userName}>{children}</UserNameProvider>
      </PlayerRuntimeContext>
    </PlayerConfigContext>
  );
}
