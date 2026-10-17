"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

/**
 * Where the learner is in a few steps (onboarding's screens, a result told in steps): one short
 * segment per step, the ones behind a quiet gray (green means right everywhere else), the current
 * one in the text color, announced as "Step 2 of 4".
 */
export function StepDots({
  className,
  current,
  total,
}: {
  className?: string;
  current: number;
  total: number;
}) {
  const t = useExtracted();

  return (
    <div
      aria-label={t("Step {current, number} of {total, number}", { current: current + 1, total })}
      className={cn("flex w-24 items-center gap-[3px]", className)}
      data-slot="step-dots"
      role="img"
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          className={cn(
            "h-1 flex-1 rounded-xs transition-colors motion-reduce:transition-none",
            index < current && "bg-foreground/25",
            index === current && "bg-foreground",
            index > current && "bg-surface-3",
          )}
          key={index}
        />
      ))}
    </div>
  );
}
