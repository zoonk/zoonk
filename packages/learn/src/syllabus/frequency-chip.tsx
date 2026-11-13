"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

type Frequency = "high" | "medium" | "low" | null;

/** "Asked a lot" on every row tells nothing, so it only marks rows when it sets some apart. */
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
    <Badge className={cn("bg-warning/15 text-foreground font-sans", className)}>
      {t({ description: "Marks a topic that comes up often in the exam.", message: "Asked a lot" })}
    </Badge>
  );
}
