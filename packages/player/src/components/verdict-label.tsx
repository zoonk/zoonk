"use client";

import { type FeedbackTone, FeedbackVerdict } from "@zoonk/learn/feedback-panel";
import { SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * "guess" and "guessRight" are a hook screen's guess, which never counts as wrong. "typo" is a
 * right answer with a spelling slip: it counts as right and shows the spelling. "unchecked" is a
 * written answer nothing checked, shown next to the sample answer and counted neither way.
 * "sampleAnswer" is a written answer the learner didn't know: its sample answer, counted neither
 * way.
 */
export type Verdict =
  | "almost"
  | "correct"
  | "guess"
  | "guessRight"
  | "incorrect"
  | "sampleAnswer"
  | "typo"
  | "unchecked";

const VERDICT_TONE: Record<Verdict, FeedbackTone> = {
  almost: "almost",
  correct: "right",
  guess: "neutral",
  guessRight: "right",
  incorrect: "wrong",
  sampleAnswer: "neutral",
  typo: "right",
  unchecked: "neutral",
};

/**
 * The verdict line of every answer's feedback, the title of the feedback panel: a plain ✓ or ✕ in
 * its color and a few words, the same on lesson screens and activities. A guess that missed keeps
 * its sparkle, since a guess is never wrong. `end` holds a quiet aside on the right, such as
 * Hyperdrive's "3 right in a row".
 */
export function VerdictLabel({ end, verdict }: { end?: React.ReactNode; verdict: Verdict }) {
  const t = useExtracted();

  const labels: Record<Verdict, string> = {
    almost: t("Almost there"),
    correct: t("Correct!"),
    guess: t("Here's the answer"),
    guessRight: t("Good guess!"),
    incorrect: t("Not quite"),
    sampleAnswer: t("Here's a good answer"),
    typo: t("Right, watch the spelling"),
    unchecked: t("Not checked this time"),
  };

  return (
    <FeedbackVerdict
      end={end}
      icon={verdict === "guess" ? <SparklesIcon aria-hidden="true" /> : undefined}
      tone={VERDICT_TONE[verdict]}
    >
      {labels[verdict]}
    </FeedbackVerdict>
  );
}
