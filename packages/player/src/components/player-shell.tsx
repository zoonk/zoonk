"use client";

import { type StoryStaticVariant } from "@zoonk/core/steps/content-contract";
import { useExtracted } from "next-intl";
import { usePlayerNavigation, usePlayerRuntime } from "../player-context";
import { type PlayerPhase } from "../player-reducer";
import {
  getCanNavigatePrev,
  getCompletionResult,
  getCurrentResult,
  getCurrentStep,
  getHasAnswer,
  getIsStaticStep,
  getIsStoryActivity,
  getProgressValue,
  getSelectedAnswer,
  getStoryBriefingText,
  getStoryMetrics,
  getStoryStaticVariant,
  getUpcomingImages,
} from "../player-selectors";
import { type PlayerActions } from "../use-player-actions";
import { useStoryHaptics } from "../use-story-haptics";
import { InPlayStickyHeader } from "./in-play-sticky-header";
import { PlayerBottomBar, PlayerBottomBarAction, PlayerBottomBarNav } from "./player-bottom-bar";
import { PlayerStage } from "./player-stage";
import { StageContent } from "./stage-content";
import { StepImagePreloader } from "./step-image-preloader";
import { StoryMetricsBar } from "./story-metrics-bar";

function BottomBarContent({
  actions,
  buttonLabel,
  canNavigatePrev,
  hasAnswer,
  isStaticStep,
  phase,
  storyStaticVariant,
}: {
  actions: PlayerActions;
  buttonLabel: string;
  canNavigatePrev: boolean;
  hasAnswer: boolean;
  isStaticStep: boolean;
  phase: PlayerPhase;
  storyStaticVariant: StoryStaticVariant | null;
}) {
  const t = useExtracted();

  if (storyStaticVariant === "storyIntro") {
    return (
      <PlayerBottomBarAction onClick={actions.navigateNext}>{t("Begin")}</PlayerBottomBarAction>
    );
  }

  if (storyStaticVariant === "storyOutcome") {
    return (
      <PlayerBottomBarAction onClick={actions.navigateNext}>{t("Continue")}</PlayerBottomBarAction>
    );
  }

  if (isStaticStep) {
    return (
      <PlayerBottomBarNav
        canNavigatePrev={canNavigatePrev}
        onNavigateNext={actions.navigateNext}
        onNavigatePrev={actions.navigatePrev}
      />
    );
  }

  return (
    <PlayerBottomBarAction
      disabled={phase === "playing" && !hasAnswer}
      onClick={phase === "feedback" ? actions.continue : actions.check}
    >
      {buttonLabel}
    </PlayerBottomBarAction>
  );
}

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
  const isStoryActivity = getIsStoryActivity(state);
  const progressValue = getProgressValue(state);
  const selectedAnswer = getSelectedAnswer(state);
  const storyBriefing = getStoryBriefingText(state);
  const storyMetrics = getStoryMetrics(state);
  const storyStaticVariant = getStoryStaticVariant(state);
  const upcomingImages = getUpcomingImages(state);

  useStoryHaptics({
    isStoryActivity,
    metrics: storyMetrics,
    phase: state.phase,
    storyStaticVariant,
  });

  const showChrome = state.phase === "playing" || state.phase === "feedback";
  const showMetricsBar = currentStep?.kind === "story" && showChrome;
  const buttonLabel = state.phase === "feedback" ? t("Continue") : t("Check");

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      {showChrome && (
        <InPlayStickyHeader
          currentStepIndex={state.currentStepIndex}
          lessonHref={lessonHref}
          progressValue={progressValue}
          storyBriefing={storyBriefing}
          totalSteps={state.steps.length}
        />
      )}

      {showMetricsBar && <StoryMetricsBar metrics={storyMetrics} />}

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
          <BottomBarContent
            actions={actions}
            buttonLabel={buttonLabel}
            canNavigatePrev={canNavigatePrev}
            hasAnswer={hasAnswer}
            isStaticStep={isStaticStep}
            phase={state.phase}
            storyStaticVariant={storyStaticVariant}
          />
        </PlayerBottomBar>
      )}

      <StepImagePreloader images={upcomingImages} />
    </main>
  );
}
