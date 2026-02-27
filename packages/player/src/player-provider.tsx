"use client";

import { type Route } from "next";
import { useCallback, useReducer } from "react";
import { type CompletionInput, type CompletionResult } from "./completion-input-schema";
import { hasNegativeDimension } from "./has-negative-dimension";
import { PlayerContext, type PlayerContextValue } from "./player-context";
import { type PlayerState, createInitialState, playerReducer } from "./player-reducer";
import { type SerializedActivity } from "./prepare-activity-data";
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
  const isStaticStep = currentStep?.kind === "static";
  const isCompleted = state.phase === "completed";
  const isIntro = state.phase === "intro";
  const hasDimensions = Object.keys(state.dimensions).length > 0;

  return {
    currentResult: currentStep ? state.results[currentStep.id] : undefined,
    currentStep,
    hasAnswer: currentStep ? Boolean(state.selectedAnswers[currentStep.id]) : false,
    isCompleted,
    isFirstStep: state.currentStepIndex === 0,
    isGameOver: isCompleted && hasDimensions && hasNegativeDimension(state.dimensions),
    isIntro,
    isStaticStep,
    progressValue: isCompleted ? 100 : computeProgress(state.currentStepIndex, state.steps.length),
    selectedAnswer: currentStep ? state.selectedAnswers[currentStep.id] : undefined,
    showActionBar: !isStaticStep && !isCompleted && !isIntro,
    showHeader: !isCompleted && !isIntro,
    totalSteps: state.steps.length,
  };
}

export function PlayerProvider<Href extends string>({
  activity,
  children,
  completionFooter,
  isAuthenticated,
  lessonHref,
  levelHref,
  loginHref,
  nextActivityHref,
  onComplete,
  onEscape,
  onNext,
  userName,
}: {
  activity: SerializedActivity;
  children: React.ReactNode;
  completionFooter?: React.ReactNode;
  isAuthenticated: boolean;
  lessonHref: Route<Href>;
  levelHref?: Route<Href>;
  loginHref?: Route<Href>;
  nextActivityHref: Route<Href> | null;
  onComplete: (input: CompletionInput) => Promise<CompletionResult>;
  onEscape: () => void;
  onNext?: () => void;
  userName?: string | null;
}) {
  const [state, dispatch] = useReducer(playerReducer, activity, createInitialState);
  const view = deriveViewState(state);
  const actions = usePlayerActions(state, dispatch, onComplete, isAuthenticated);

  const handleNext = useCallback(() => {
    onNext?.();
  }, [onNext]);

  usePlayerKeyboard({
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
    completionFooter,
    completionResult: actions.completionResult,
    currentStepIndex: state.currentStepIndex,
    dimensions: state.dimensions,
    escape: onEscape,
    isAuthenticated,
    lessonHref,
    levelHref,
    loginHref,
    next: handleNext,
    nextActivityHref,
    phase: state.phase,
    results: state.results,
  };

  return (
    <PlayerContext value={contextValue}>
      <UserNameProvider initialName={userName}>{children}</UserNameProvider>
    </PlayerContext>
  );
}
