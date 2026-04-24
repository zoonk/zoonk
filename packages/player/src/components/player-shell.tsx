"use client";

import { useExtracted } from "next-intl";
import { usePlayerMilestone, usePlayerRuntime } from "../player-context";
import {
  getCurrentResult,
  getCurrentStep,
  getInvestigationProgress,
  getProgressValue,
  getStoryMetrics,
  getUpcomingImages,
} from "../player-selectors";
import { usePlayerHaptics } from "../use-player-haptics";
import { InPlayStickyHeader } from "./in-play-sticky-header";
import { PlayerBottomBar } from "./player-bottom-bar";
import { PlayerStage } from "./player-stage";
import { StageContent } from "./stage-content";
import { StatusPill, StatusPillLabel, StatusPillValue } from "./status-pill";
import { StepActionButton } from "./step-action-button";
import { StepImagePreloader } from "./step-image-preloader";
import { PlayerContentFrame } from "./step-layouts";
import { StoryMetricsBar } from "./story-metrics-bar";

/**
 * The mobile bottom bar only exists for primary actions like Check or Continue.
 * Navigable read screens now rely on swipe and keyboard input instead of a
 * second row of visible navigation controls.
 */
function BottomBarContent() {
  return (
    <PlayerContentFrame>
      <StepActionButton />
    </PlayerContentFrame>
  );
}

export function PlayerShell() {
  const t = useExtracted();
  const { screen, state } = usePlayerRuntime();
  const milestone = usePlayerMilestone();

  const currentResult = getCurrentResult(state);
  const currentStep = getCurrentStep(state);

  const shouldShowStickyBottomBar =
    screen.showChrome && screen.bottomBar?.kind === "primaryAction" && !screen.stageIsFullBleed;

  const progressValue = getProgressValue(state);
  const storyMetrics = getStoryMetrics(state);
  const upcomingImages = getUpcomingImages(state);

  usePlayerHaptics({
    current: {
      metrics: storyMetrics,
      phase: state.phase,
      result: currentResult,
      step: currentStep,
    },
    milestoneKind: milestone.kind,
  });

  const investigationProgress = getInvestigationProgress(state);

  const evidencePill = investigationProgress ? (
    <StatusPill animationKey={investigationProgress.collected}>
      <StatusPillValue className="text-muted-foreground">
        {investigationProgress.collected} / {investigationProgress.total}
      </StatusPillValue>

      <StatusPillLabel>{t("evidence")}</StatusPillLabel>
    </StatusPill>
  ) : undefined;

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      {screen.showChrome && (
        <InPlayStickyHeader centerContent={evidencePill} progressValue={progressValue} />
      )}

      {screen.showMetricsBar && <StoryMetricsBar metrics={storyMetrics} />}

      <PlayerStage
        isFullBleed={screen.stageIsFullBleed}
        isStatic={screen.stageIsStatic}
        phase={state.phase}
        scene={screen.scene}
      >
        <StageContent />
      </PlayerStage>

      {shouldShowStickyBottomBar && (
        <PlayerBottomBar className="lg:hidden">
          <BottomBarContent />
        </PlayerBottomBar>
      )}

      <StepImagePreloader images={upcomingImages} />
    </main>
  );
}
