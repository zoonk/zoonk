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
        "mx-auto w-full max-w-2xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
      data-slot="player-bottom-bar"
      {...props}
    />
  );
}

export function PlayerBottomBarNav({
  isFirstStep,
  onNavigateNext,
  onNavigatePrev,
}: {
  isFirstStep: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
}) {
  const t = useExtracted();

  return (
    <nav aria-label={t("Step navigation")} className="flex items-center justify-between">
      <Button
        aria-label={t("Previous step")}
        disabled={isFirstStep}
        onClick={onNavigatePrev}
        size="icon"
        variant="ghost"
      >
        <ChevronLeft className="size-4" />
      </Button>

      <Button aria-label={t("Next step")} onClick={onNavigateNext} size="icon" variant="ghost">
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}

export function PlayerBottomBarAction({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return <Button className={cn("w-full", className)} size="lg" {...props} />;
}
