"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

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
