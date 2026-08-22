"use client";

import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerProgressSnapshot } from "@zoonk/core/player/contracts/progress-snapshot";
import { useCallback, useMemo, useReducer } from "react";
import {
  getEffectiveCompletionProgressSnapshot,
  getStoredCompletionMilestoneKeys,
} from "./completion-milestone-storage";
import {
  PlayerConfigContext,
  type PlayerLessonProgress,
  type PlayerLinkComponent,
  type PlayerMilestone,
  type PlayerNavigation,
  type PlayerQuestionSupport,
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
import { usePlayerKeyboard } from "./use-player-keyboard";
import { UserNameProvider } from "./user-name-context";

export type { PlayerStepChangeEvent } from "./player-events";
export { type PlayerQuestionContext, type PlayerQuestionSupport } from "./player-context";

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
  questionSupport,
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
  onComplete: (input: CompletionInput) => void;
  onEscape: (href: PlayerRoute) => void;
  onNext?: () => void;
  onStepChange?: (event: PlayerStepChangeEvent) => void;
  progressSnapshot?: PlayerProgressSnapshot | null;
  questionSupport?: PlayerQuestionSupport;
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
      requiresStartConfirmation: !viewer.isAuthenticated,
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

  const handleNext = useCallback(() => {
    onNext?.();
  }, [onNext]);

  const escapeHref =
    screen.scene === "completion" && milestone?.kind === "course"
      ? milestone.courseHref
      : navigation.chapterHref;

  usePlayerKeyboard({
    interactionState: questionSupport?.interactionState ?? "active",
    keyboard: screen.keyboard,
    onCheck: actions.check,
    onContinue: actions.continue,
    onEscape: () => onEscape(escapeHref),
    onNavigateNext: actions.navigateNext,
    onNavigatePrev: actions.navigatePrev,
    onNext: onNext ? handleNext : null,
    onRestart: actions.restart,
  });

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
      next: handleNext,
      questionSupport: questionSupport ?? null,
      viewer,
    }),
    [
      lesson.description,
      lesson.kind,
      lesson.title,
      chapterTitle,
      courseTitle,
      handleNext,
      lessonDescription,
      lessonProgress,
      lessonTitle,
      linkComponent,
      milestone,
      navigation,
      questionSupport,
      viewer,
    ],
  );

  const runtimeValue = useMemo(() => ({ actions, screen, state }), [actions, screen, state]);

  return (
    <PlayerConfigContext value={configValue}>
      <PlayerRuntimeContext value={runtimeValue}>
        <UserNameProvider initialName={viewer.userName}>{children}</UserNameProvider>
      </PlayerRuntimeContext>
    </PlayerConfigContext>
  );
}
