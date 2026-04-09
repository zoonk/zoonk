"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * Fixed bottom bar for the player's action buttons on mobile.
 *
 * Uses px-4 horizontal padding to match PlayerStage's p-4, with
 * max-w-2xl on the inner content area. This ensures the button
 * aligns with InteractiveStepLayout's max-w-2xl content above —
 * both use the same padding-outside-constraint structure.
 */
export function PlayerBottomBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-background/95 sticky bottom-0 z-30 backdrop-blur-sm",
        "w-full px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-2xl" data-slot="player-bottom-bar" {...props} />
    </div>
  );
}

export function PlayerBottomBarNav({
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
    <nav aria-label={t("Step navigation")} className="flex items-center justify-between">
      <Button
        aria-label={t("Previous step")}
        disabled={!canNavigatePrev}
        onClick={onNavigatePrev}
        size="icon-lg"
        variant="outline"
      >
        <ChevronLeft />
      </Button>

      <Button aria-label={t("Next step")} onClick={onNavigateNext} size="icon-lg" variant="outline">
        <ChevronRight />
      </Button>
    </nav>
  );
}
