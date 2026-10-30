"use client";

import { type FeedbackTone, FeedbackVerdict } from "@zoonk/learn/feedback-panel";
import { SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";

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

export function VerdictLabel({ end, verdict }: { end?: React.ReactNode; verdict: Verdict }) {
  const t = useExtracted();

  const labels: Record<Verdict, string> = {
    almost: t({
      description: "Verdict on an answer that is almost right.",
      message: "Almost there",
    }),
    correct: t("Correct!"),
    guess: t("Here's the answer"),
    guessRight: t("Good guess!"),
    incorrect: t({
      description:
        "Verdict on a wrong answer, said gently: not “almost right”, which is a separate verdict, and not “not this time”.",
      message: "Not quite",
    }),
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

export function NotQuiteLead() {
  const t = useExtracted();

  return (
    <span className="text-destructive-text font-semibold">
      {t({
        description: "Starts the explanation of why the learner's answer is wrong.",
        message: "Not quite:",
      })}
    </span>
  );
}
