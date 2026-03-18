"use client";

import { useExtracted } from "next-intl";
import { usePlayerNavigation, usePlayerRuntime } from "../player-context";
import {
  getCanNavigatePrev,
  getChangedDimensions,
  getCompletionResult,
  getCurrentResult,
  getCurrentStep,
  getHasAnswer,
  getIsStaticStep,
  getProgressValue,
  getSelectedAnswer,
} from "../player-selectors";
import { InPlayStickyHeader } from "./in-play-sticky-header";
import { PlayerBottomBar, PlayerBottomBarAction, PlayerBottomBarNav } from "./player-bottom-bar";
import { PlayerCloseLink, PlayerHeader } from "./player-header";
import { PlayerStage } from "./player-stage";
import { StageContent } from "./stage-content";

export function PlayerShell() {
  const t = useExtracted();
  const { actions, state } = usePlayerRuntime();
  const { lessonHref, nextActivityHref } = usePlayerNavigation();

  const canNavigatePrev = getCanNavigatePrev(state);
  const changedDimensions = getChangedDimensions(state);
  const completionResult = getCompletionResult(state);
  const currentResult = getCurrentResult(state);
  const currentStep = getCurrentStep(state);
  const hasAnswer = getHasAnswer(state);
  const isStaticStep = getIsStaticStep(state);
  const progressValue = getProgressValue(state);
  const selectedAnswer = getSelectedAnswer(state);

  const hasDimensions = Object.keys(state.dimensions).length > 0;
  const isIntro = state.phase === "intro";
  const showChrome = state.phase === "playing" || state.phase === "feedback";
  const buttonLabel = state.phase === "feedback" ? t("Continue") : t("Check");

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      {isIntro && (
        <div className="bg-background/95 sticky top-0 z-30 backdrop-blur-sm">
          <PlayerHeader>
            <PlayerCloseLink href={lessonHref} />
          </PlayerHeader>
        </div>
      )}

      {showChrome && (
        <InPlayStickyHeader
          changedDimensions={changedDimensions}
          currentStepIndex={state.currentStepIndex}
          dimensions={state.dimensions}
          hasDimensions={hasDimensions}
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
          dimensions={state.dimensions}
          lessonHref={lessonHref}
          nextActivityHref={nextActivityHref}
          onNavigateNext={actions.navigateNext}
          onNavigatePrev={actions.navigatePrev}
          onRestart={actions.restart}
          onSelectAnswer={actions.selectAnswer}
          onStartChallenge={actions.startChallenge}
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
    </main>
  );
}
