"use client";

import { type Route } from "next";
import { useCallback, useMemo, useReducer } from "react";
import { type CompletionInput, type CompletionResult } from "./completion-input-schema";
import { hasNegativeDimension } from "./dimensions";
import { PlayerContext, type PlayerContextValue } from "./player-context";
import { type PlayerState, createInitialState, playerReducer } from "./player-reducer";
import { type SerializedActivity } from "./prepare-activity-data";
import { canNavigatePrev, isStaticNavigationStep } from "./step-navigation";
import { usePlayerActions } from "./use-player-actions";
import { usePlayerKeyboard } from "./use-player-keyboard";
import { UserNameProvider } from "./user-name-context";

function computeProgress(currentIndex: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round(((currentIndex + 1) / total) * 100);
}

function deriveViewState(state: PlayerState) {
  const currentStep = state.steps[state.currentStepIndex];
  const isStaticStep = isStaticNavigationStep(currentStep);
  const isCompleted = state.phase === "completed";
  const isIntro = state.phase === "intro";
  const hasDimensions = Object.keys(state.dimensions).length > 0;

  return {
    canNavigatePrev: canNavigatePrev(state.steps, state.currentStepIndex),
    currentResult: currentStep ? state.results[currentStep.id] : undefined,
    currentStep,
    hasAnswer: currentStep ? Boolean(state.selectedAnswers[currentStep.id]) : false,
    isCompleted,
    isGameOver: isCompleted && hasDimensions && hasNegativeDimension(state.dimensions),
    isIntro,
    isStaticStep,
    progressValue: isCompleted ? 100 : computeProgress(state.currentStepIndex, state.steps.length),
    selectedAnswer: currentStep ? state.selectedAnswers[currentStep.id] : undefined,
    showBottomBar: !isCompleted && !isIntro,
    showHeader: !isCompleted && !isIntro,
    totalSteps: state.steps.length,
  };
}

export function PlayerProvider<Href extends string>({
  activity,
  children,
  chapterHref,
  completionFooter,
  courseHref,
  isAuthenticated,
  isCourseComplete = false,
  isLastInLesson = false,
  isNextChapter = false,
  lessonHref,
  lessonTitle = "",
  levelHref,
  loginHref,
  nextActivityHref,
  nextChapterHref = null,
  nextLessonHref = null,
  nextLessonTitle = null,
  onComplete,
  onEscape,
  onNext,
  userName,
}: {
  activity: SerializedActivity;
  chapterHref?: Route<Href>;
  children: React.ReactNode;
  completionFooter?: React.ReactNode;
  courseHref?: Route<Href>;
  isAuthenticated: boolean;
  isCourseComplete?: boolean;
  isLastInLesson?: boolean;
  isNextChapter?: boolean;
  lessonHref: Route<Href>;
  lessonTitle?: string;
  levelHref?: Route<Href>;
  loginHref?: Route<Href>;
  nextActivityHref: Route<Href> | null;
  nextChapterHref?: Route<Href> | null;
  nextLessonHref?: Route<Href> | null;
  nextLessonTitle?: string | null;
  onComplete: (input: CompletionInput) => Promise<CompletionResult>;
  onEscape: () => void;
  onNext?: () => void;
  userName?: string | null;
}) {
  const [state, dispatch] = useReducer(playerReducer, activity, createInitialState);
  const view = deriveViewState(state);
  const actions = usePlayerActions(state, dispatch, onComplete, isAuthenticated);

  const changedDimensions = useMemo(() => {
    const changed = new Set<string>();

    for (const [name, value] of Object.entries(state.dimensions)) {
      const previous: number | undefined = state.previousDimensions[name];

      if (value !== previous) {
        changed.add(name);
      }
    }

    return changed;
  }, [state.dimensions, state.previousDimensions]);

  const handleNext = useCallback(() => {
    onNext?.();
  }, [onNext]);

  usePlayerKeyboard({
    canNavigatePrev: view.canNavigatePrev,
    hasAnswer: view.hasAnswer,
    isStaticStep: view.isStaticStep,
    onCheck: actions.check,
    onContinue: actions.continue,
    onEscape,
    onNavigateNext: actions.navigateNext,
    onNavigatePrev: actions.navigatePrev,
    onNext: onNext && !view.isGameOver ? handleNext : null,
    onRestart: actions.restart,
    onStartChallenge: view.isIntro ? actions.startChallenge : null,
    phase: state.phase,
  });

  const contextValue: PlayerContextValue<Href> = {
    ...actions,
    ...view,
    activityId: state.activityId,
    changedDimensions,
    chapterHref: chapterHref ?? lessonHref,
    completionFooter,
    completionResult: actions.completionResult,
    courseHref: courseHref ?? lessonHref,
    currentStepIndex: state.currentStepIndex,
    dimensions: state.dimensions,
    escape: onEscape,
    isAuthenticated,
    isCourseComplete,
    isLastInLesson,
    isNextChapter,
    lessonHref,
    lessonTitle,
    levelHref,
    loginHref,
    next: handleNext,
    nextActivityHref,
    nextChapterHref,
    nextLessonHref,
    nextLessonTitle,
    phase: state.phase,
    results: state.results,
  };

  return (
    <PlayerContext value={contextValue}>
      <UserNameProvider initialName={userName}>{children}</UserNameProvider>
    </PlayerContext>
  );
}
