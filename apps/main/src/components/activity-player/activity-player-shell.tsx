"use client";

import { type SerializedActivity } from "@/data/activities/prepare-activity-data";
import { useRouter } from "@/i18n/navigation";
import { useExtracted } from "next-intl";
import { useCallback } from "react";
import { checkStep } from "./check-step";
import { getFeedbackVariant } from "./feedback-screen";
import { PlayerActionBar, PlayerActionButton } from "./player-action-bar";
import { PlayerCloseLink, PlayerHeader, PlayerStepFraction } from "./player-header";
import { PlayerProgressBar } from "./player-progress-bar";
import { type SelectedAnswer } from "./player-reducer";
import { PlayerStage } from "./player-stage";
import { StageContent } from "./stage-content";
import { usePlayerKeyboard } from "./use-player-keyboard";
import { usePlayerState } from "./use-player-state";

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

  const currentStep = state.steps[state.currentStepIndex];
  const isStaticStep = currentStep?.kind === "static";
  const hasAnswer = currentStep ? Boolean(state.selectedAnswers[currentStep.id]) : false;
  const currentResult = currentStep ? state.results[currentStep.id] : undefined;
  const feedbackVariant = currentResult ? getFeedbackVariant(currentResult) : undefined;
  const totalSteps = state.steps.length;
  const isCompleted = state.phase === "completed";

  const progressValue = isCompleted ? 100 : computeProgress(state.currentStepIndex, totalSteps);

  const handleEscape = useCallback(() => {
    router.push(lessonHref);
  }, [router, lessonHref]);

  const handleSelectAnswer = useCallback(
    (stepId: string, answer: SelectedAnswer) => {
      dispatch({ answer, stepId, type: "SELECT_ANSWER" });
    },
    [dispatch],
  );

  const handleCheck = useCallback(() => {
    if (!currentStep) {
      return;
    }

    const answer = state.selectedAnswers[currentStep.id];

    if (!answer) {
      return;
    }

    const { effects, result } = checkStep(currentStep, answer);
    dispatch({ effects, result, stepId: currentStep.id, type: "CHECK_ANSWER" });
  }, [currentStep, state.selectedAnswers, dispatch]);

  const handleContinue = useCallback(() => {
    dispatch({ type: "CONTINUE" });
  }, [dispatch]);

  const handleNavigateNext = useCallback(() => {
    dispatch({ direction: "next", type: "NAVIGATE_STEP" });
  }, [dispatch]);

  const handleNavigatePrev = useCallback(() => {
    dispatch({ direction: "prev", type: "NAVIGATE_STEP" });
  }, [dispatch]);

  usePlayerKeyboard({
    hasAnswer,
    isStaticStep,
    onCheck: handleCheck,
    onContinue: handleContinue,
    onEscape: handleEscape,
    onNavigateNext: handleNavigateNext,
    onNavigatePrev: handleNavigatePrev,
    phase: state.phase,
  });

  const buttonLabel = state.phase === "feedback" ? t("Continue") : t("Check");

  return (
    <main className="flex min-h-dvh flex-col">
      <PlayerHeader>
        <PlayerCloseLink href={lessonHref} />
        <PlayerStepFraction>
          {state.currentStepIndex + 1} / {totalSteps}
        </PlayerStepFraction>
      </PlayerHeader>

      <PlayerProgressBar value={progressValue} />

      <PlayerStage feedback={feedbackVariant} phase={state.phase}>
        <StageContent
          activityId={state.activityId}
          currentResult={currentResult}
          currentStep={currentStep}
          currentStepIndex={state.currentStepIndex}
          isCompleted={isCompleted}
          lessonHref={lessonHref}
          nextActivityHref={nextActivityHref}
          onSelectAnswer={handleSelectAnswer}
          phase={state.phase}
          results={state.results}
          selectedAnswer={currentStep ? state.selectedAnswers[currentStep.id] : undefined}
        />
      </PlayerStage>

      {!isStaticStep && !isCompleted && (
        <PlayerActionBar>
          <PlayerActionButton
            disabled={state.phase === "playing" && !hasAnswer}
            onClick={state.phase === "feedback" ? handleContinue : handleCheck}
          >
            {buttonLabel}
          </PlayerActionButton>
        </PlayerActionBar>
      )}
    </main>
  );
}

function computeProgress(currentIndex: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round(((currentIndex + 1) / total) * 100);
}
