"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * Fixed bottom bar for the player's action buttons on mobile and tablet.
 *
 * Only provides the sticky container and safe-area padding. Inner width is
 * controlled by each mode's content: the action button uses the shared player
 * frame so it aligns with the centered step container, while the navigation
 * arrows span the full viewport width so they sit at the screen edges on
 * tablet — otherwise the frame would cap them at `max-w-2xl` and center them.
 */
export function PlayerBottomBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-background/95 sticky bottom-0 z-30 backdrop-blur-sm",
        "w-full py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
      data-slot="player-bottom-bar"
      {...props}
    />
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
    <nav
      aria-label={t("Step navigation")}
      className="flex w-full items-center justify-between px-4"
    >
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
