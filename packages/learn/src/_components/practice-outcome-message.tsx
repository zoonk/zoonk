"use client";

import { useExtracted } from "next-intl";
import { type AreaPracticeOutcome } from "../_utils/use-practice-run";

export function PracticeOutcomeMessage({
  dailyCap,
  nothingToPractice,
  outcome,
}: {
  dailyCap: string;
  nothingToPractice: string;
  outcome: AreaPracticeOutcome | null;
}) {
  const t = useExtracted();

  if (!outcome || outcome === "started") {
    return null;
  }

  const messages: Record<Exclude<AreaPracticeOutcome, "started">, string> = {
    dailyCap,
    failed: t("That didn't work. Try again in a moment."),
    nothingToPractice,
  };

  return (
    <p className="text-muted-foreground text-sm" role="status">
      {messages[outcome]}
    </p>
  );
}
