"use client";

import { useExtracted } from "next-intl";
import { usePlayerNavigation, usePlayerRuntime } from "../player-context";
import {
  getCanNavigatePrev,
  getCompletionResult,
  getCurrentResult,
  getCurrentStep,
  getHasAnswer,
  getIsStaticStep,
  getProgressValue,
  getSelectedAnswer,
  getUpcomingImages,
} from "../player-selectors";
import { InPlayStickyHeader } from "./in-play-sticky-header";
import { PlayerBottomBar, PlayerBottomBarAction, PlayerBottomBarNav } from "./player-bottom-bar";
import { PlayerStage } from "./player-stage";
import { StageContent } from "./stage-content";
import { StepImagePreloader } from "./step-image-preloader";

export function PlayerShell() {
  const t = useExtracted();
  const { actions, state } = usePlayerRuntime();
  const { lessonHref, nextActivityHref } = usePlayerNavigation();

  const canNavigatePrev = getCanNavigatePrev(state);
  const completionResult = getCompletionResult(state);
  const currentResult = getCurrentResult(state);
  const currentStep = getCurrentStep(state);
  const hasAnswer = getHasAnswer(state);
  const isStaticStep = getIsStaticStep(state);
  const progressValue = getProgressValue(state);
  const selectedAnswer = getSelectedAnswer(state);
  const upcomingImages = getUpcomingImages(state);

  const showChrome = state.phase === "playing" || state.phase === "feedback";
  const buttonLabel = state.phase === "feedback" ? t("Continue") : t("Check");

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      {showChrome && (
        <InPlayStickyHeader
          currentStepIndex={state.currentStepIndex}
          lessonHref={lessonHref}
          progressValue={progressValue}
          totalSteps={state.steps.length}
        />
      )}

      <PlayerStage isStatic={isStaticStep && state.phase === "playing"} phase={state.phase}>
        <StageContent
          canNavigatePrev={canNavigatePrev}
          completionResult={completionResult}
          currentResult={currentResult}
          currentStep={currentStep}
          currentStepIndex={state.currentStepIndex}
          lessonHref={lessonHref}
          nextActivityHref={nextActivityHref}
          onNavigateNext={actions.navigateNext}
          onNavigatePrev={actions.navigatePrev}
          onRestart={actions.restart}
          onSelectAnswer={actions.selectAnswer}
          phase={state.phase}
          results={state.results}
          selectedAnswer={selectedAnswer}
        />
      </PlayerStage>

      {showChrome && (
        <PlayerBottomBar className={isStaticStep ? "lg:hidden" : undefined}>
          {isStaticStep ? (
            <PlayerBottomBarNav
              canNavigatePrev={canNavigatePrev}
              onNavigateNext={actions.navigateNext}
              onNavigatePrev={actions.navigatePrev}
            />
          ) : (
            <PlayerBottomBarAction
              disabled={state.phase === "playing" && !hasAnswer}
              onClick={state.phase === "feedback" ? actions.continue : actions.check}
            >
              {buttonLabel}
            </PlayerBottomBarAction>
          )}
        </PlayerBottomBar>
      )}

      <StepImagePreloader images={upcomingImages} />
    </main>
  );
}
