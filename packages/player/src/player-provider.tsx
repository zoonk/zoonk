"use client";

import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { useCallback, useMemo, useReducer } from "react";
import {
  PlayerConfigContext,
  type PlayerMilestone,
  type PlayerNavigation,
  PlayerRuntimeContext,
  type PlayerViewer,
} from "./player-context";
import { type InitialStateInput } from "./player-initial-state";
import { createInitialState, playerReducer } from "./player-reducer";
import { getPlayerScreenModel } from "./player-screen";
import { usePlayerActions } from "./use-player-actions";
import { usePlayerKeyboard } from "./use-player-keyboard";
import { UserNameProvider } from "./user-name-context";

export function PlayerProvider({
  lesson,
  chapterTitle,
  children,
  lessonDescription,
  lessonTitle,
  milestone,
  navigation,
  onComplete,
  onEscape,
  onNext,
  totalBrainPower,
  viewer,
}: {
  lesson: SerializedLesson;
  chapterTitle: string;
  children: React.ReactNode;
  lessonDescription: string;
  lessonTitle: string;
  milestone: PlayerMilestone | null;
  navigation: PlayerNavigation;
  onComplete: (input: CompletionInput) => void;
  onEscape: () => void;
  onNext?: () => void;
  totalBrainPower: number;
  viewer: PlayerViewer;
}) {
  const initInput: InitialStateInput = useMemo(
    () => ({ lesson, totalBrainPower }),
    [lesson, totalBrainPower],
  );
  const [state, dispatch] = useReducer(playerReducer, initInput, createInitialState);
  const actions = usePlayerActions(state, dispatch, onComplete, viewer.isAuthenticated);
  const screen = useMemo(() => getPlayerScreenModel(state), [state]);

  const handleNext = useCallback(() => {
    onNext?.();
  }, [onNext]);

  usePlayerKeyboard({
    keyboard: screen.keyboard,
    onCheck: actions.check,
    onContinue: actions.continue,
    onEscape,
    onNavigateNext: actions.navigateNext,
    onNavigatePrev: actions.navigatePrev,
    onNext: onNext ? handleNext : null,
    onRestart: actions.restart,
  });

  const configValue = useMemo(
    () => ({
      escape: onEscape,
      lessonMeta: {
        chapterTitle,
        fallbackDescription: lessonDescription,
        kind: lesson.kind,
        lessonDescription: lesson.description,
        lessonTitle,
        title: lesson.title,
      },
      milestone,
      navigation,
      next: handleNext,
      viewer,
    }),
    [
      lesson.description,
      lesson.kind,
      lesson.title,
      chapterTitle,
      handleNext,
      lessonDescription,
      lessonTitle,
      milestone,
      navigation,
      onEscape,
      viewer,
    ],
  );

  const runtimeValue = useMemo(
    () => ({
      actions,
      screen,
      state,
    }),
    [actions, screen, state],
  );

  return (
    <PlayerConfigContext value={configValue}>
      <PlayerRuntimeContext value={runtimeValue}>
        <UserNameProvider initialName={viewer.userName}>{children}</UserNameProvider>
      </PlayerRuntimeContext>
    </PlayerConfigContext>
  );
}
