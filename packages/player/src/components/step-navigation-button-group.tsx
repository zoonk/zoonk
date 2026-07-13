"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type PointerEvent } from "react";
import { renderPlayerShortcutHintKey, showPlayerShortcutHint } from "../player-shortcut-hint";

/**
 * Read-only steps need explicit touch targets because swipe gestures are
 * discoverable only after the learner already knows they exist. This group
 * keeps swipe navigation intact while giving mobile and tablet users a clear
 * tappable path through static, vocabulary, and alphabet screens, plus an
 * optional trailing control for prompt-specific actions like audio playback.
 */
export function StepNavigationButtonGroup({
  audioAction,
  canNavigatePrev,
  onNavigateNext,
  onNavigatePrev,
}: {
  audioAction?: React.ReactNode;
  canNavigatePrev: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
}) {
  const t = useExtracted();

  /**
   * Narrow layouts can still be controlled with a mouse, so teach the back
   * shortcut from the actual pointer instead of assuming this button is touch-only.
   */
  function handleNavigatePreviousPointerUp(event: PointerEvent<HTMLButtonElement>) {
    showPlayerShortcutHint({
      event,
      hint: "navigatePrevious",
      message: t.rich("Press <kbd>←</kbd> to go back.", { kbd: renderPlayerShortcutHintKey }),
    });
  }

  /**
   * Narrow desktop windows need the same contextual discovery as the floating
   * desktop arrow while touch taps remain excluded by the shared pointer check.
   */
  function handleNavigateNextPointerUp(event: PointerEvent<HTMLButtonElement>) {
    showPlayerShortcutHint({
      event,
      hint: "navigateNext",
      message: t.rich("Press <kbd>→</kbd> to continue.", { kbd: renderPlayerShortcutHintKey }),
    });
  }

  return (
    <div className="flex w-full gap-2" data-slot="step-navigation-button-group">
      {canNavigatePrev && (
        <Button
          aria-label={t("Previous")}
          aria-keyshortcuts="ArrowLeft"
          onClick={onNavigatePrev}
          onPointerUp={handleNavigatePreviousPointerUp}
          size="icon-lg"
          type="button"
          variant="outline"
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
      )}

      <Button
        aria-keyshortcuts="ArrowRight"
        className={cn("min-w-0 flex-1", !canNavigatePrev && !audioAction && "w-full")}
        onClick={onNavigateNext}
        onPointerUp={handleNavigateNextPointerUp}
        size="lg"
        type="button"
      >
        <span>{t("Next")}</span>
        <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
      </Button>

      {audioAction}
    </div>
  );
}
