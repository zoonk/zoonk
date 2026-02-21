"use client";

import { useCallback, useReducer } from "react";
import { type CompletionInput, type CompletionResult } from "./completion-input-schema";
import { hasNegativeDimension } from "./has-negative-dimension";
import { PlayerContext, type PlayerContextValue, type PlayerLinkComponent } from "./player-context";
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

export function PlayerProvider({
  activity,
  children,
  completionFooter,
  lessonHref,
  levelHref,
  linkComponent,
  loginHref,
  nextActivityHref,
  onComplete,
  onEscape,
  onNext,
}: {
  activity: SerializedActivity;
  children: React.ReactNode;
  completionFooter?: React.ReactNode;
  lessonHref: string;
  levelHref?: string;
  linkComponent: PlayerLinkComponent;
  loginHref?: string;
  nextActivityHref: string | null;
  onComplete: (input: CompletionInput) => Promise<CompletionResult>;
  onEscape: () => void;
  onNext?: () => void;
}) {
  const [state, dispatch] = useReducer(playerReducer, activity, createInitialState);
  const view = deriveViewState(state);
  const actions = usePlayerActions(state, dispatch, onComplete);

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

  const contextValue: PlayerContextValue = {
    ...actions,
    ...view,
    LinkComponent: linkComponent,
    activityId: state.activityId,
    completionFooter,
    completionResult: actions.completionResult,
    currentStepIndex: state.currentStepIndex,
    dimensions: state.dimensions,
    escape: onEscape,
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
      <UserNameProvider>{children}</UserNameProvider>
    </PlayerContext>
  );
}
