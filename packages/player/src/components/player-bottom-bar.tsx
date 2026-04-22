"use client";

import { cn } from "@zoonk/ui/lib/utils";

/**
 * Fixed bottom bar for the player's action buttons on mobile and tablet.
 *
 * Read-only step navigation now happens via swipe and keyboard, so this shell
 * only needs to anchor the primary action row above the device safe area.
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
