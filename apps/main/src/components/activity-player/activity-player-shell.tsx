"use client";

import { type SerializedActivity } from "@/data/activities/prepare-activity-data";
import { useRouter } from "@/i18n/navigation";
import { useExtracted } from "next-intl";
import { useCallback } from "react";
import { checkStep } from "./check-step";
import { hasNegativeDimension } from "./dimension-inventory";
import { DimensionStatusButton } from "./dimension-status-button";
import { PlayerActionBar, PlayerActionButton } from "./player-action-bar";
import {
  PlayerCloseLink,
  PlayerHeader,
  PlayerNav,
  PlayerNavButton,
  PlayerNavGroup,
  PlayerStepFraction,
} from "./player-header";
import { PlayerProgressBar } from "./player-progress-bar";
import { type PlayerState, type SelectedAnswer } from "./player-reducer";
import { PlayerStage } from "./player-stage";
import { StageContent } from "./stage-content";
import { usePlayerKeyboard } from "./use-player-keyboard";
import { usePlayerState } from "./use-player-state";
import { UserNameProvider } from "./user-name-context";

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
    hasDimensions,
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

export function ActivityPlayerShell({
  activity,
  lessonHref,
  nextActivityHref,
}: {
  activity: SerializedActivity;
  lessonHref: string;
  nextActivityHref: string | null;
}) {
  const t = useExtracted();
  const router = useRouter();
  const { dispatch, state } = usePlayerState(activity);
  const view = deriveViewState(state);

  const handleEscape = useCallback(() => {
    router.push(lessonHref);
  }, [router, lessonHref]);

  const handleSelectAnswer = useCallback(
    (stepId: string, answer: SelectedAnswer | null) => {
      if (answer) {
        dispatch({ answer, stepId, type: "SELECT_ANSWER" });
      } else {
        dispatch({ stepId, type: "CLEAR_ANSWER" });
      }
    },
    [dispatch],
  );

  const handleCheck = useCallback(() => {
    if (!view.currentStep) {
      return;
    }

    const answer = state.selectedAnswers[view.currentStep.id];

    if (!answer) {
      return;
    }

    const { effects, result } = checkStep(view.currentStep, answer);
    dispatch({ effects, result, stepId: view.currentStep.id, type: "CHECK_ANSWER" });
  }, [view.currentStep, state.selectedAnswers, dispatch]);

  const handleContinue = useCallback(() => {
    dispatch({ type: "CONTINUE" });
  }, [dispatch]);

  const handleNavigateNext = useCallback(() => {
    dispatch({ direction: "next", type: "NAVIGATE_STEP" });
  }, [dispatch]);

  const handleNavigatePrev = useCallback(() => {
    dispatch({ direction: "prev", type: "NAVIGATE_STEP" });
  }, [dispatch]);

  const handleRestart = useCallback(() => {
    dispatch({ type: "RESTART" });
  }, [dispatch]);

  const handleStartChallenge = useCallback(() => {
    dispatch({ type: "START_CHALLENGE" });
  }, [dispatch]);

  const handleNext = useCallback(() => {
    if (nextActivityHref) {
      router.push(nextActivityHref);
    }
  }, [router, nextActivityHref]);

  usePlayerKeyboard({
    hasAnswer: view.hasAnswer,
    isStaticStep: view.isStaticStep,
    onCheck: handleCheck,
    onContinue: handleContinue,
    onEscape: handleEscape,
    onNavigateNext: handleNavigateNext,
    onNavigatePrev: handleNavigatePrev,
    onNext: nextActivityHref && !view.isGameOver ? handleNext : null,
    onRestart: handleRestart,
    onStartChallenge: view.isIntro ? handleStartChallenge : null,
    phase: state.phase,
  });

  const buttonLabel = state.phase === "feedback" ? t("Continue") : t("Check");

  return (
    <UserNameProvider>
      <main className="flex min-h-dvh flex-col">
        {view.isIntro && (
          <PlayerHeader>
            <PlayerCloseLink href={lessonHref} />
            <div className="size-9" aria-hidden="true" />
          </PlayerHeader>
        )}

        {view.showHeader && (
          <PlayerHeader>
            <PlayerCloseLink href={lessonHref} />

            {view.isStaticStep && (
              <PlayerNav>
                <PlayerNavGroup>
                  <PlayerNavButton
                    direction="prev"
                    disabled={view.isFirstStep}
                    onClick={handleNavigatePrev}
                  />
                  <PlayerStepFraction>
                    {state.currentStepIndex + 1} / {view.totalSteps}
                  </PlayerStepFraction>
                  <PlayerNavButton direction="next" onClick={handleNavigateNext} />
                </PlayerNavGroup>
              </PlayerNav>
            )}

            {!view.isStaticStep && (
              <PlayerStepFraction>
                {state.currentStepIndex + 1} / {view.totalSteps}
              </PlayerStepFraction>
            )}

            {view.hasDimensions ? (
              <DimensionStatusButton dimensions={state.dimensions} />
            ) : (
              <div className="size-9" aria-hidden="true" />
            )}
          </PlayerHeader>
        )}

        {view.showHeader && <PlayerProgressBar value={view.progressValue} />}

        <PlayerStage phase={state.phase}>
          <StageContent
            activityId={state.activityId}
            currentResult={view.currentResult}
            currentStep={view.currentStep}
            currentStepIndex={state.currentStepIndex}
            dimensions={state.dimensions}
            isCompleted={view.isCompleted}
            isFirst={view.isFirstStep}
            lessonHref={lessonHref}
            nextActivityHref={nextActivityHref}
            onNavigateNext={handleNavigateNext}
            onNavigatePrev={handleNavigatePrev}
            onRestart={handleRestart}
            onSelectAnswer={handleSelectAnswer}
            onStartChallenge={handleStartChallenge}
            phase={state.phase}
            results={state.results}
            selectedAnswer={view.selectedAnswer}
          />
        </PlayerStage>

        {view.showActionBar && (
          <PlayerActionBar>
            <PlayerActionButton
              disabled={state.phase === "playing" && !view.hasAnswer}
              onClick={state.phase === "feedback" ? handleContinue : handleCheck}
            >
              {buttonLabel}
            </PlayerActionButton>
          </PlayerActionBar>
        )}
      </main>
    </UserNameProvider>
  );
}

function computeProgress(currentIndex: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round(((currentIndex + 1) / total) * 100);
}
