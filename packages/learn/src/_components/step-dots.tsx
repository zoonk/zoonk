"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

/**
 * Where the learner is in a few steps (onboarding's screens, a result told in steps): one dot per
 * step, the current one a longer pill, announced as "Step 2 of 4".
 */
export function StepDots({ current, total }: { current: number; total: number }) {
  const t = useExtracted();

  return (
    <div
      aria-label={t("Step {current, number} of {total, number}", { current: current + 1, total })}
      className="flex items-center gap-1.5"
      data-slot="step-dots"
      role="img"
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          className={cn(
            "bg-foreground/20 h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none",
            index === current ? "bg-foreground w-5" : "w-1.5",
          )}
          key={index}
        />
      ))}
    </div>
  );
}
