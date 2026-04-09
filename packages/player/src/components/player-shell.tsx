"use client";

import { useExtracted } from "next-intl";
import { usePlayerNavigation, usePlayerRuntime } from "../player-context";
import {
  getCanNavigatePrev,
  getCurrentStep,
  getInvestigationProgress,
  getInvestigationScenarioData,
  getIsStaticStep,
  getIsStoryActivity,
  getProgressValue,
  getStoryBriefingText,
  getStoryMetrics,
  getStoryStaticVariant,
  getUpcomingImages,
} from "../player-selectors";
import { type PlayerActions } from "../use-player-actions";
import { useStoryHaptics } from "../use-story-haptics";
import { InPlayStickyHeader } from "./in-play-sticky-header";
import { PlayerBottomBar, PlayerBottomBarNav } from "./player-bottom-bar";
import { PlayerStage } from "./player-stage";
import { StageContent } from "./stage-content";
import { StatusPill } from "./status-pill";
import { StepActionButton } from "./step-action-button";
import { StepImagePreloader } from "./step-image-preloader";
import { StoryMetricsBar } from "./story-metrics-bar";

/**
 * Renders the content inside the bottom bar.
 *
 * Static navigation steps (static, visual, vocabulary) show prev/next arrows.
 * Everything else (story static, interactive, investigation) uses
 * StepActionButton — the single source of truth for action button logic.
 */
function BottomBarContent({
  actions,
  canNavigatePrev,
  isStaticStep,
}: {
  actions: PlayerActions;
  canNavigatePrev: boolean;
  isStaticStep: boolean;
}) {
  if (isStaticStep) {
    return (
      <PlayerBottomBarNav
        canNavigatePrev={canNavigatePrev}
        onNavigateNext={actions.navigateNext}
        onNavigatePrev={actions.navigatePrev}
      />
    );
  }

  return <StepActionButton />;
}

export function PlayerShell() {
  const t = useExtracted();
  const { actions, state } = usePlayerRuntime();
  const { lessonHref } = usePlayerNavigation();

  const canNavigatePrev = getCanNavigatePrev(state);
  const currentStep = getCurrentStep(state);
  const isStaticStep = getIsStaticStep(state);
  const isStoryActivity = getIsStoryActivity(state);
  const progressValue = getProgressValue(state);
  const storyMetrics = getStoryMetrics(state);
  const storyStaticVariant = getStoryStaticVariant(state);
  const upcomingImages = getUpcomingImages(state);

  useStoryHaptics({
    isStoryActivity,
    metrics: storyMetrics,
    phase: state.phase,
    storyStaticVariant,
  });

  const contextRecall =
    getStoryBriefingText(state) ?? getInvestigationScenarioData(state)?.scenario ?? null;

  const investigationProgress = getInvestigationProgress(state);
  const showChrome = state.phase === "playing" || state.phase === "feedback";
  const showMetricsBar = currentStep?.kind === "story" && showChrome;

  const evidencePill = investigationProgress ? (
    <StatusPill animationKey={investigationProgress.collected}>
      <span className="text-muted-foreground text-xs font-semibold tabular-nums">
        {investigationProgress.collected} / {investigationProgress.total}
      </span>

      <span className="text-muted-foreground text-xs">{t("evidence")}</span>
    </StatusPill>
  ) : undefined;

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      {showChrome && (
        <InPlayStickyHeader
          centerContent={evidencePill}
          contextRecall={contextRecall}
          currentStepIndex={state.currentStepIndex}
          lessonHref={lessonHref}
          progressValue={progressValue}
          totalSteps={state.steps.length}
        />
      )}

      {showMetricsBar && <StoryMetricsBar metrics={storyMetrics} />}

      <PlayerStage isStatic={isStaticStep && state.phase === "playing"} phase={state.phase}>
        <StageContent />
      </PlayerStage>

      {showChrome && (
        <PlayerBottomBar className="lg:hidden">
          <BottomBarContent
            actions={actions}
            canNavigatePrev={canNavigatePrev}
            isStaticStep={isStaticStep}
          />
        </PlayerBottomBar>
      )}

      <StepImagePreloader images={upcomingImages} />
    </main>
  );
}
