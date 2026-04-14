"use client";

import { useExtracted } from "next-intl";
import { usePlayerMilestone, usePlayerRuntime } from "../player-context";
import {
  getCurrentResult,
  getCurrentStep,
  getInvestigationProgress,
  getInvestigationScenarioData,
  getProgressValue,
  getStoryBriefingText,
  getStoryMetrics,
  getUpcomingImages,
} from "../player-selectors";
import { usePlayerHaptics } from "../use-player-haptics";
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
  const milestone = usePlayerMilestone();

  const currentResult = getCurrentResult(state);
  const currentStep = getCurrentStep(state);
  const progressValue = getProgressValue(state);
  const storyMetrics = getStoryMetrics(state);
  const upcomingImages = getUpcomingImages(state);

  usePlayerHaptics({
    current: {
      metrics: storyMetrics,
      phase: state.phase,
      result: currentResult,
      step: currentStep,
      storyStaticVariant: screen.storyStaticVariant,
    },
    milestoneKind: milestone.kind,
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
          progressValue={progressValue}
        />
      )}

      {screen.showMetricsBar && <StoryMetricsBar metrics={storyMetrics} />}

      <PlayerStage isStatic={screen.stageIsStatic} phase={state.phase} scene={screen.scene}>
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
