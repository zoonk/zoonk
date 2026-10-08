"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

type Frequency = "high" | "medium" | "low" | null;

/** "Appears a lot" on every row tells nothing, so it only marks rows when it sets some apart. */
export function setsApart(items: readonly { frequency: Frequency }[]): boolean {
  const frequent = items.filter((item) => item.frequency === "high").length;
  return frequent > 0 && frequent < items.length;
}

/** "Appears a lot": a topic or subject past exams asked most, as a small pill at a row's end. */
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
        "bg-warning/15 text-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {t("Appears a lot")}
    </span>
  );
}
