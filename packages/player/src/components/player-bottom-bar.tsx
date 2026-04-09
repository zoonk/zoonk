"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerContentFrame } from "./step-layouts";

/**
 * Fixed bottom bar for the player's action buttons on mobile.
 *
 * The inner content uses the same shared player frame as the stage content.
 * That keeps mobile actions aligned with the centered step container instead
 * of relying on duplicated width classes.
 */
export function PlayerBottomBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-background/95 sticky bottom-0 z-30 backdrop-blur-sm",
        "w-full py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <PlayerContentFrame data-slot="player-bottom-bar" {...props} />
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
