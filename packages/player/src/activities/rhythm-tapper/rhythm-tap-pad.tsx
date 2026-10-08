"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { Hand } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * The big pad the learner taps. A tap counts the moment the finger or button goes down (not on
 * release), and Space works from anywhere while the rhythm plays.
 */
export function RhythmTapPad({
  isActive,
  isCountingIn,
  onTap,
  ref,
}: {
  isActive: boolean;
  isCountingIn: boolean;
  onTap: (timeMs: number) => void;
  ref: React.Ref<HTMLButtonElement>;
}) {
  const t = useExtracted();

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!isActive) {
      return;
    }

    event.preventDefault();
    onTap(event.timeStamp);
  }

  return (
    <button
      aria-disabled={!isActive}
      aria-keyshortcuts="Space"
      className={cn(
        "bg-muted flex h-32 w-full touch-none flex-col items-center justify-center gap-1 rounded-3xl outline-none select-none",
        "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        isActive
          ? "cursor-pointer motion-safe:transition-transform motion-safe:active:scale-[0.98]"
          : "cursor-default opacity-60",
      )}
      data-slot="rhythm-tap-pad"
      onPointerDown={handlePointerDown}
      ref={ref}
      type="button"
    >
      <Hand aria-hidden="true" className="size-7" />
      <span className="text-base font-semibold">
        {isCountingIn ? t("Get ready…") : t("Tap here")}
      </span>
      {/* Only with a keyboard, like the player's other shortcut hints. */}
      <span className="text-muted-foreground hidden text-sm lg:pointer-fine:inline">
        {t("or press Space")}
      </span>
    </button>
  );
}
