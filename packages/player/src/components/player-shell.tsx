"use client";

import { useExtracted } from "next-intl";
import { usePlayerNavigation, usePlayerRuntime } from "../player-context";
import {
  getInvestigationProgress,
  getInvestigationScenarioData,
  getIsStoryActivity,
  getProgressValue,
  getStoryBriefingText,
  getStoryMetrics,
  getUpcomingImages,
} from "../player-selectors";
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
 * Mobile bottom-bar content switches between arrow navigation and the shared
 * step action button. The screen model decides which mode is active; this
 * component only renders the matching mobile control.
 */
function BottomBarContent() {
  const { actions, screen } = usePlayerRuntime();

  if (screen.bottomBar?.kind === "navigation") {
    return (
      <PlayerBottomBarNav
        canNavigatePrev={screen.bottomBar.canNavigatePrev}
        onNavigateNext={actions.navigateNext}
        onNavigatePrev={actions.navigatePrev}
      />
    );
  }

  return <StepActionButton />;
}

export function PlayerShell() {
  const t = useExtracted();
  const { screen, state } = usePlayerRuntime();
  const { lessonHref } = usePlayerNavigation();

  const isStoryActivity = getIsStoryActivity(state);
  const progressValue = getProgressValue(state);
  const storyMetrics = getStoryMetrics(state);
  const upcomingImages = getUpcomingImages(state);

  useStoryHaptics({
    isStoryActivity,
    metrics: storyMetrics,
    phase: state.phase,
    storyStaticVariant: screen.storyStaticVariant,
  });

  const contextRecall =
    getStoryBriefingText(state) ?? getInvestigationScenarioData(state)?.scenario ?? null;

  const investigationProgress = getInvestigationProgress(state);

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
      {screen.showChrome && (
        <InPlayStickyHeader
          centerContent={evidencePill}
          contextRecall={contextRecall}
          currentStepIndex={state.currentStepIndex}
          lessonHref={lessonHref}
          progressValue={progressValue}
          totalSteps={state.steps.length}
        />
      )}

      {screen.showMetricsBar && <StoryMetricsBar metrics={storyMetrics} />}

      <PlayerStage isStatic={screen.stageIsStatic} phase={state.phase}>
        <StageContent />
      </PlayerStage>

      {screen.showChrome && screen.bottomBar && (
        <PlayerBottomBar className="lg:hidden">
          <BottomBarContent />
        </PlayerBottomBar>
      )}

      <StepImagePreloader images={upcomingImages} />
    </main>
  );
}
