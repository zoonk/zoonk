"use client";

import { useExtracted } from "next-intl";
import { usePlayerRuntime } from "../player-context";
import {
  getCurrentResult,
  getCurrentStep,
  getProgressValue,
  getUpcomingImages,
} from "../player-selectors";
import { usePlayerHaptics } from "../use-player-haptics";
import { InPlayStickyHeader } from "./in-play-sticky-header";
import { PlayerBottomBar } from "./player-bottom-bar";
import { PlayerStage } from "./player-stage";
import { StageContent } from "./stage-content";
import { StepActionButton } from "./step-action-button";
import { StepImagePreloader } from "./step-image-preloader";
import { PlayerContentFrame } from "./step-layouts";
import { StepNavigationButtonGroup } from "./step-navigation-button-group";

/**
 * The mobile bottom bar owns the explicit controls that are easy to miss when
 * they only exist as gestures or keyboard shortcuts. Primary-action screens
 * render Check/Continue, while read-only screens render Previous/Next buttons.
 */
function BottomBarContent() {
  const { actions, screen } = usePlayerRuntime();

  return (
    <PlayerContentFrame>
      {screen.bottomBar?.kind === "navigation" ? (
        <StepNavigationButtonGroup
          canNavigatePrev={screen.bottomBar.canNavigatePrev}
          onNavigateNext={actions.navigateNext}
          onNavigatePrev={actions.navigatePrev}
        />
      ) : (
        <StepActionButton />
      )}
    </PlayerContentFrame>
  );
}

/**
 * Gives the scroll-owning stage a new DOM identity when the visible player
 * surface changes. Inline feedback keeps the same step surface so learners
 * stay near the answer they checked, while dedicated feedback and completion
 * screens start from the top because their first content is a new result image
 * or summary.
 */
function getStageResetKey({ screenKind, stepId }: { screenKind: string; stepId?: string }) {
  return `${stepId ?? "completion"}:${screenKind}`;
}

export function PlayerShell() {
  const t = useExtracted();
  const { screen, state } = usePlayerRuntime();

  const currentResult = getCurrentResult(state);
  const currentStep = getCurrentStep(state);

  const shouldShowStickyBottomBar =
    screen.showChrome && Boolean(screen.bottomBar) && !screen.stageIsFullBleed;

  const progressValue = getProgressValue(state);
  const upcomingImages = getUpcomingImages(state);
  const stageResetKey = getStageResetKey({ screenKind: screen.kind, stepId: currentStep?.id });

  usePlayerHaptics({ current: { phase: state.phase, result: currentResult, step: currentStep } });

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      {screen.showChrome && <InPlayStickyHeader progressValue={progressValue} />}

      <PlayerStage
        aria-label={t("Player screen")}
        isFullBleed={screen.stageIsFullBleed}
        isStatic={screen.stageIsStatic}
        key={stageResetKey}
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
