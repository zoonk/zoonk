"use client";

import { type SerializedActivity } from "@/data/activities/prepare-activity-data";
import { useExtracted } from "next-intl";
import { useCallback } from "react";
import { PlayerActionBar, PlayerActionButton } from "./player-action-bar";
import { PlayerCloseLink, PlayerHeader, PlayerStepFraction } from "./player-header";
import { PlayerProgressBar } from "./player-progress-bar";
import { usePlayerKeyboard } from "./use-player-keyboard";
import { usePlayerState } from "./use-player-state";

export function ActivityPlayerShell({
  activity,
  lessonHref,
}: {
  activity: SerializedActivity;
  lessonHref: string;
}) {
  const t = useExtracted();
  const { dispatch, state } = usePlayerState(activity);

  const currentStep = state.steps[state.currentStepIndex];
  const isStaticStep = currentStep?.kind === "static";
  const hasAnswer = currentStep ? Boolean(state.selectedAnswers[currentStep.id]) : false;
  const totalSteps = state.steps.length;

  const progressValue =
    state.phase === "completed" ? 100 : computeProgress(state.currentStepIndex, totalSteps);

  const handleCheck = useCallback(() => {
    // No-op until step renderers exist (Issue 9)
  }, []);

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

      <section className="flex flex-1 flex-col items-center justify-center p-4">
        {/* Step content will be rendered here by step renderers (Issue 9) */}
      </section>

      {!isStaticStep && (
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
