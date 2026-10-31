"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

type Frequency = "high" | "medium" | "low" | null;

/** "Appears a lot" on every row tells nothing, so it only marks rows when it sets some apart. */
export function setsApart(items: readonly { frequency: Frequency }[]): boolean {
  const frequent = items.filter((item) => item.frequency === "high").length;
  return frequent > 0 && frequent < items.length;
}

export function FrequencyChip({
  className,
  frequency,
}: {
  className?: string;
  frequency: Frequency;
}) {
  const t = useExtracted();

  if (frequency !== "high") {
    return null;
  }

  return (
    <span
      className={cn(
        "bg-warning/15 text-foreground shrink-0 rounded-md px-1.5 py-0.5 font-sans text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {t({
        description: "Marks a topic that comes up often in the exam.",
        message: "Appears a lot",
      })}
    </span>
  );
}
