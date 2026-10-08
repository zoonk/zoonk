"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon, CircleDashedIcon, CircleXIcon, SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * "guess" and "guessRight" are a hook screen's guess, which never counts as wrong. "typo" is a
 * right answer with a spelling slip: it counts as right and shows the spelling. "unchecked" is a
 * written answer nothing checked, shown next to the sample answer and counted neither way.
 */
export type Verdict =
  | "almost"
  | "correct"
  | "guess"
  | "guessRight"
  | "incorrect"
  | "typo"
  | "unchecked";

const VERDICT_TONE: Record<Verdict, string> = {
  almost: "text-warning",
  correct: "text-success",
  guess: "text-foreground",
  guessRight: "text-success",
  incorrect: "text-destructive",
  typo: "text-success",
  unchecked: "text-foreground",
};

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  if (verdict === "correct" || verdict === "guessRight" || verdict === "typo") {
    return <CircleCheckIcon aria-hidden="true" className="size-[1.1em]" />;
  }

  if (verdict === "guess") {
    return <SparklesIcon aria-hidden="true" className="size-[1.1em]" />;
  }

  if (verdict === "unchecked") {
    return <CircleDashedIcon aria-hidden="true" className="size-[1.1em]" />;
  }

  return <CircleXIcon aria-hidden="true" className="size-[1.1em]" />;
}

/**
 * The verdict line of every answer's feedback: icon, tone and words stay the same on lesson
 * screens, activities and inline checks.
 */
export function VerdictLabel({ verdict }: { verdict: Verdict }) {
  const t = useExtracted();

  const labels: Record<Verdict, string> = {
    almost: t("Almost there"),
    correct: t("Correct!"),
    guess: t("Here's the answer"),
    guessRight: t("Good guess!"),
    incorrect: t("Not quite"),
    typo: t("Right, watch the spelling"),
    unchecked: t("Not checked this time"),
  };

  return (
    <p
      className={cn("flex items-start gap-2 text-lg font-semibold", VERDICT_TONE[verdict])}
      data-slot="lesson-result-verdict"
    >
      {/* Sized by the verdict's type and kept on its first line. */}
      <LineMarker>
        <VerdictIcon verdict={verdict} />
      </LineMarker>
      {labels[verdict]}
    </p>
  );
}
