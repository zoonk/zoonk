"use client";

import { type SerializedActivity } from "@/data/activities/prepare-activity-data";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback } from "react";
import { FeedbackScreenContent, getFeedbackVariant } from "./feedback-screen";
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
  const router = useRouter();
  const { dispatch, state } = usePlayerState(activity);

  const currentStep = state.steps[state.currentStepIndex];
  const isStaticStep = currentStep?.kind === "static";
  const hasAnswer = currentStep ? Boolean(state.selectedAnswers[currentStep.id]) : false;
  const currentResult = currentStep ? state.results[currentStep.id] : undefined;
  const feedbackVariant = currentResult ? getFeedbackVariant(currentResult) : undefined;
  const totalSteps = state.steps.length;

  const progressValue =
    state.phase === "completed" ? 100 : computeProgress(state.currentStepIndex, totalSteps);

  const handleEscape = useCallback(() => {
    router.push(lessonHref);
  }, [router, lessonHref]);

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

      <section
        className={cn(
          "flex flex-1 flex-col items-center overflow-y-auto transition-colors duration-300",
          state.phase === "feedback"
            ? "justify-start px-6 pt-16 sm:px-8 sm:pt-24"
            : "justify-center p-4",
          feedbackVariant === "correct" && "bg-success/5",
          feedbackVariant === "incorrect" && "bg-destructive/5",
        )}
      >
        {state.phase === "feedback" && currentResult ? (
          <FeedbackScreenContent result={currentResult} />
        ) : // Step content will be rendered here by step renderers (Issue 9)
        null}
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
