"use client";

import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerProgressSnapshot } from "@zoonk/core/player/contracts/progress-snapshot";
import { useMemo, useReducer } from "react";
import {
  getEffectiveCompletionProgressSnapshot,
  getStoredCompletionMilestoneKeys,
} from "./completion-milestone-storage";
import { type PlayerCompletionHandler } from "./completion-persistence";
import {
  PlayerConfigContext,
  type PlayerLessonProgress,
  type PlayerLinkComponent,
  type PlayerMilestone,
  type PlayerNavigation,
  type PlayerRoute,
  PlayerRuntimeContext,
  type PlayerViewer,
} from "./player-context";
import { getLocalDate } from "./player-date";
import { type PlayerStepChangeEvent } from "./player-events";
import { type InitialStateInput } from "./player-initial-state";
import { createInitialState, playerReducer } from "./player-reducer";
import { getPlayerScreenModel } from "./player-screen";
import { usePlayerActions } from "./use-player-actions";
import { UserNameProvider } from "./user-name-context";

export type { PlayerCompletionOutcome, PlayerCompletionHandler } from "./completion-persistence";
export type { PlayerStepChangeEvent } from "./player-events";

export function PlayerProvider({
  lesson,
  chapterTitle,
  children,
  courseTitle,
  lessonDescription,
  lessonProgress,
  lessonTitle,
  linkComponent,
  milestone,
  navigation,
  onComplete,
  onEscape,
  onNext,
  onStepChange,
  progressSnapshot = null,
  totalBrainPower,
  viewer,
}: {
  lesson: SerializedLesson;
  chapterTitle: string;
  children: React.ReactNode;
  courseTitle: string;
  lessonDescription: string;
  lessonProgress: PlayerLessonProgress;
  lessonTitle: string;
  linkComponent: PlayerLinkComponent;
  milestone: PlayerMilestone | null;
  navigation: PlayerNavigation;
  onComplete: PlayerCompletionHandler;
  onEscape: (href: PlayerRoute) => void;
  onNext?: () => void;
  onStepChange?: (event: PlayerStepChangeEvent) => void;
  progressSnapshot?: PlayerProgressSnapshot | null;
  totalBrainPower: number;
  viewer: PlayerViewer;
}) {
  const initInput: InitialStateInput = useMemo(
    () => ({
      lesson,
      progressSnapshot: viewer.isAuthenticated
        ? getEffectiveCompletionProgressSnapshot({
            localDate: getLocalDate(new Date()),
            progressSnapshot,
          })
        : null,
      shownCompletionMilestoneKeys: viewer.isAuthenticated
        ? getStoredCompletionMilestoneKeys()
        : [],
      totalBrainPower: viewer.isAuthenticated ? totalBrainPower : 0,
    }),
    [lesson, progressSnapshot, totalBrainPower, viewer.isAuthenticated],
  );

  const [state, dispatch] = useReducer(playerReducer, initInput, createInitialState);

  const actions = usePlayerActions({ dispatch, onComplete, onStepChange, state });

  const screen = useMemo(() => getPlayerScreenModel(state), [state]);

  const configValue = useMemo(
    () => ({
      lessonMeta: {
        chapterTitle,
        courseTitle,
        fallbackDescription: lessonDescription,
        kind: lesson.kind,
        lessonDescription: lesson.description,
        lessonProgress,
        lessonTitle,
        title: lesson.title,
      },
      linkComponent,
      milestone,
      navigation,
      next: onNext ?? null,
      onEscape,
      viewer,
    }),
    [
      lesson.description,
      lesson.kind,
      lesson.title,
      chapterTitle,
      courseTitle,
      lessonDescription,
      lessonProgress,
      lessonTitle,
      linkComponent,
      milestone,
      navigation,
      onEscape,
      onNext,
      viewer,
    ],
  );

  const runtimeValue = useMemo(
    () => ({ actions, completionPersistence: actions.completionPersistence, screen, state }),
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
