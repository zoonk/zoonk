"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { BrainIcon, CheckIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";

/**
 * The Brain Power a task or the day's missions give, wherever it's offered: its mark and number in
 * Brain Power's violet, then its name, at the size of the line it sits in. Earned, the number is a
 * chip. `explained` underlines the name when a tap on it says what Brain Power is.
 */
export function BrainPowerAmount({
  earned = false,
  explained = false,
  points,
}: {
  earned?: boolean;
  explained?: boolean;
  points: number;
}) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <span
      className="inline-flex flex-wrap items-center gap-x-1.5 leading-snug"
      data-slot="brain-power-amount"
    >
      {/* Earned, the chip is `brain-text`: the page's color on `brain` is under AA in light. */}
      <span
        className={cn(
          "flex items-center gap-1 font-mono font-semibold tabular-nums",
          earned
            ? "bg-brain-text text-background rounded-sm py-0.5 pr-1.5 pl-1"
            : "text-brain-text",
        )}
      >
        {earned ? (
          <CheckIcon aria-hidden="true" className="size-3" strokeWidth={3} />
        ) : (
          <BrainIcon aria-hidden="true" className="text-brain size-3.5" />
        )}
        {`+${format.number(points)}`}
      </span>
      <span
        className={cn(
          "text-muted-foreground font-sans",
          explained && "decoration-faint underline decoration-dotted underline-offset-2",
        )}
      >
        {t("Brain Power")}
      </span>
    </span>
  );
}
