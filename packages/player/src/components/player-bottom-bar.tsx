"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useExtracted } from "next-intl";

export function PlayerBottomBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-background/95 sticky bottom-0 z-30 backdrop-blur-sm",
        "mx-auto w-full max-w-2xl p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
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
