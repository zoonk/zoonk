"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * Read-only steps need an explicit touch target because swipe gestures are
 * discoverable only after the learner already knows they exist. This group
 * keeps swipe navigation intact while giving mobile and tablet users a clear
 * tappable path through static, vocabulary, and alphabet screens.
 */
export function StepNavigationButtonGroup({
  canNavigatePrev,
  onNavigateNext,
  onNavigatePrev,
}: {
  canNavigatePrev: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
}) {
  const t = useExtracted();

  return (
    <div
      className={cn("grid w-full gap-2", canNavigatePrev ? "grid-cols-2" : "grid-cols-1")}
      data-slot="step-navigation-button-group"
    >
      {canNavigatePrev && (
        <Button
          aria-keyshortcuts="ArrowLeft"
          className="min-w-0"
          onClick={onNavigatePrev}
          size="lg"
          type="button"
          variant="outline"
        >
          <ChevronLeftIcon aria-hidden="true" data-icon="inline-start" />
          <span>{t("Previous")}</span>
        </Button>
      )}

      <Button
        aria-keyshortcuts="ArrowRight"
        className="min-w-0"
        onClick={onNavigateNext}
        size="lg"
        type="button"
      >
        <span>{t("Next")}</span>
        <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
      </Button>
    </div>
  );
}
