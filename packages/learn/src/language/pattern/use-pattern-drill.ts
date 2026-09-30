"use client";

import { type MistakePatternView } from "@zoonk/core/language/patterns/contract";
import { useState, useTransition } from "react";

/** What the drill earned, from core: right answers of the total and the Brain Power paid. */
export type PatternPracticeResult = { brainPower: number; correct: number; total: number };

type DrillStep =
  | { kind: "intro" }
  | { index: number; kind: "question" }
  | { kind: "result"; result: PatternPracticeResult };

/**
 * The drill's steps: the pattern card, one question per screen (answers are checked here against
 * the drill, so feedback is immediate), then the result once core has saved every answer.
 */
export function usePatternDrill({
  drill,
  practice,
}: {
  drill: MistakePatternView["drill"];
  practice: (answers: string[]) => Promise<PatternPracticeResult | null>;
}) {
  const [step, setStep] = useState<DrillStep>({ kind: "intro" });
  const [answers, setAnswers] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [isSaving, startSaving] = useTransition();

  const index = step.kind === "question" ? step.index : 0;
  const question = step.kind === "question" ? drill[step.index] : undefined;
  const answer = answers[index] ?? null;

  const save = (finished: string[]) => {
    setFailed(false);

    startSaving(async () => {
      const result = await practice(finished);

      if (result) {
        setStep({ kind: "result", result });
      } else {
        setFailed(true);
      }
    });
  };

  return {
    answer,
    failed,
    index,
    isSaving,
    next: () => {
      if (index + 1 < drill.length) {
        setStep({ index: index + 1, kind: "question" });
        return;
      }

      save(answers);
    },
    pick: (option: string) => {
      if (step.kind === "question" && answer === null) {
        setAnswers([...answers.slice(0, index), option]);
      }
    },
    question,
    retry: () => save(answers),
    start: () => {
      setAnswers([]);
      setStep({ index: 0, kind: "question" });
    },
    step,
  };
}
