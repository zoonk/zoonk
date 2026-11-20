"use client";

import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

/** A whole pixel each: shares of the width round apart, so one dash would draw narrower. */
function dashWidth(total: number): CSSPropertiesWithVariables {
  return { "--dash": `round(down, calc((100% - ${total - 1} * 3px) / ${total}), 1px)` };
}

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
      className={cn("flex w-24 items-center justify-center gap-[3px]", className)}
      data-slot="step-dots"
      role="img"
      style={dashWidth(total)}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          className={cn(
            "h-1 w-(--dash) flex-none rounded-xs transition-colors motion-reduce:transition-none",
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
