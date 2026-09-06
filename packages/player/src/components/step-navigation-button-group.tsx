"use client";

import { Button } from "@zoonk/ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ContextualQuestionAction } from "./lesson-question-actions";

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

  return (
    <div className="flex w-full gap-2" data-slot="step-navigation-button-group">
      {canNavigatePrev && (
        <Button
          aria-label={t("Previous")}
          aria-keyshortcuts="ArrowLeft"
          onClick={onNavigatePrev}
          size="icon-lg"
          type="button"
          variant="outline"
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
      )}

      <Button
        aria-keyshortcuts="ArrowRight"
        className="min-w-0 flex-1"
        onClick={onNavigateNext}
        size="lg"
        type="button"
      >
        <span>{t("Next")}</span>
        <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
      </Button>

      <ContextualQuestionAction />
      {audioAction}
    </div>
  );
}
