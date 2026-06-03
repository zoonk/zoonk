"use client";

import { useExtracted } from "next-intl";
import { useCallback, useState } from "react";
import { PlayerAudioProvider } from "../player-audio-context";
import { usePlayerRuntime } from "../player-context";
import {
  getCurrentResult,
  getCurrentStep,
  getProgressValue,
  getUpcomingImages,
} from "../player-selectors";
import { usePlayerHaptics } from "../use-player-haptics";
import { InPlayStickyHeader } from "./in-play-sticky-header";
import { PlayAudioButton } from "./play-audio-button";
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
  const audioUrl = screen.bottomBar?.audioUrl ?? null;
  const audioAction = audioUrl ? <BottomBarAudioAction audioUrl={audioUrl} /> : null;

  return (
    <PlayerContentFrame>
      {screen.bottomBar?.kind === "navigation" ? (
        <StepNavigationButtonGroup
          audioAction={audioAction}
          canNavigatePrev={screen.bottomBar.canNavigatePrev}
          onNavigateNext={actions.navigateNext}
          onNavigatePrev={actions.navigatePrev}
        />
      ) : (
        <div className="flex w-full gap-2">
          <StepActionButton className="min-w-0 flex-1" />
          {audioAction}
        </div>
      )}
    </PlayerContentFrame>
  );
}

/**
 * Renders the secondary bottom-bar audio icon only for steps with prompt audio.
 *
 * The center play button stays in the step content; this small duplicate gives
 * thumb-reachable access on mobile without adding noise to non-audio steps.
 */
function BottomBarAudioAction({ audioUrl }: { audioUrl: string }) {
  return <PlayAudioButton audioUrl={audioUrl} variant="outline" />;
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

/**
 * Remounts the shared audio provider when the active step changes.
 *
 * The provider owns the reusable audio element for duplicate prompt controls,
 * so keying by step and URL guarantees any still-playing clip is cleaned up
 * when the learner advances to a different prompt.
 */
function getAudioProviderKey({ audioUrl, stepId }: { audioUrl: string | null; stepId?: string }) {
  return `${stepId ?? "completion"}:${audioUrl ?? "no-audio"}`;
}

export function PlayerShell() {
  const t = useExtracted();
  const { screen, state } = usePlayerRuntime();
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);

  const currentResult = getCurrentResult(state);
  const currentStep = getCurrentStep(state);

  const shouldShowStickyBottomBar =
    screen.showChrome && Boolean(screen.bottomBar) && !screen.stageIsFullBleed;

  const progressValue = getProgressValue(state);
  const upcomingImages = getUpcomingImages(state);
  const bottomBarAudioUrl = screen.bottomBar?.audioUrl ?? null;

  const audioProviderKey = getAudioProviderKey({
    audioUrl: bottomBarAudioUrl,
    stepId: currentStep?.id,
  });

  const stageResetKey = getStageResetKey({ screenKind: screen.kind, stepId: currentStep?.id });

  const enableAutoPlayAudio = useCallback(() => setAutoPlayAudio(true), []);

  usePlayerHaptics({ current: { phase: state.phase, result: currentResult, step: currentStep } });

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      {screen.showChrome && <InPlayStickyHeader progressValue={progressValue} />}

      <PlayerAudioProvider
        audioUrl={bottomBarAudioUrl}
        autoPlayAudio={autoPlayAudio}
        key={audioProviderKey}
        onAutoPlayAudioEnabled={enableAutoPlayAudio}
      >
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
          <PlayerBottomBar aria-label={t("Player controls")} className="lg:hidden" role="toolbar">
            <BottomBarContent />
          </PlayerBottomBar>
        )}
      </PlayerAudioProvider>

      <StepImagePreloader images={upcomingImages} />
    </main>
  );
}
