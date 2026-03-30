"use client";

import { useCallback, useMemo, useReducer } from "react";
import { type CompletionInput } from "./completion-input-schema";
import {
  PlayerConfigContext,
  type PlayerMilestone,
  type PlayerNavigation,
  PlayerRuntimeContext,
  type PlayerViewer,
} from "./player-context";
import { type InitialStateInput } from "./player-initial-state";
import { createInitialState, playerReducer } from "./player-reducer";
import { getCanNavigatePrev, getHasAnswer, getIsStaticStep } from "./player-selectors";
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
  totalBrainPower,
  viewer,
}: {
  activity: SerializedActivity;
  children: React.ReactNode;
  milestone: PlayerMilestone;
  navigation: PlayerNavigation;
  onComplete: (input: CompletionInput) => void;
  onEscape: () => void;
  onNext?: () => void;
  totalBrainPower: number;
  viewer: PlayerViewer;
}) {
  const initInput: InitialStateInput = useMemo(
    () => ({ activity, totalBrainPower }),
    [activity, totalBrainPower],
  );
  const [state, dispatch] = useReducer(playerReducer, initInput, createInitialState);
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
    onNext: onNext ? handleNext : null,
    onRestart: actions.restart,
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
