"use client";

import { CircleCheck, CircleMinus, CircleX } from "lucide-react";
import { useExtracted } from "next-intl";

export type Verdict = "correct" | "incorrect" | "partial";

const VERDICT_CONFIG: Record<Verdict, { colorClass: string; icon: typeof CircleCheck }> = {
  correct: { colorClass: "text-success", icon: CircleCheck },
  incorrect: { colorClass: "text-destructive", icon: CircleX },
  partial: { colorClass: "text-warning", icon: CircleMinus },
};

/**
 * Returns the user-facing label for a verdict.
 *
 * Centralizes verdict text so VerdictLabel and ResultAnnouncement
 * don't duplicate translation strings.
 */
export function useVerdictText(verdict: Verdict): string {
  const t = useExtracted();

  if (verdict === "correct") {
    return t("Correct!");
  }

  if (verdict === "partial") {
    return t("Good, but...");
  }

  return t("Not quite");
}

/**
 * Displays a verdict icon + label for answer feedback.
 *
 * Used across feedback screens to show whether the learner's answer
 * was correct, partially correct, or incorrect. Keeps the icon,
 * color, and label consistent everywhere feedback is shown.
 */
export function VerdictLabel({ verdict }: { verdict: Verdict }) {
  const { colorClass, icon: Icon } = VERDICT_CONFIG[verdict];
  const text = useVerdictText(verdict);

  return (
    <div className="flex items-center gap-1.5 text-sm font-medium">
      <Icon aria-hidden="true" className={`${colorClass} size-4`} />
      <span className={colorClass}>{text}</span>
    </div>
  );
}
