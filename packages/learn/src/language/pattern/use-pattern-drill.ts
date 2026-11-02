"use client";

import { type MistakePatternView } from "@zoonk/core/language/patterns/contract";
import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { type ProgressCelebration } from "@zoonk/core/sessions/progress-celebration";
import { useMemo, useState, useTransition } from "react";
import { type TaskSegment } from "../../_components/task-header";

export type PatternPracticeResult = ProgressCelebration & {
  brainPower: number;
  correct: number;
  missionMoment?: MissionMomentView | null;
  total: number;
};

export type PatternDrillAnswers = { answers: string[]; requestId: string };

type DrillStep =
  | { kind: "intro" }
  | { index: number; kind: "question" }
  | { kind: "result"; result: PatternPracticeResult };

export function usePatternDrill({
  drill,
  practice,
}: {
  drill: MistakePatternView["drill"];
  practice: (drill: PatternDrillAnswers) => Promise<PatternPracticeResult | null>;
}) {
  // One id for this drill, sent again by "Try again", so a retry after a lost response counts once.
  const requestId = useMemo(() => crypto.randomUUID(), []);
  const [step, setStep] = useState<DrillStep>({ kind: "intro" });
  const [answers, setAnswers] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [isSaving, startSaving] = useTransition();

  const index = step.kind === "question" ? step.index : 0;
  const question = step.kind === "question" ? drill[step.index] : undefined;
  const answer = answers[index] ?? null;

  const save = (finished: string[]) => {
    setFailed(false);

    startSaving(async () => {
      const result = await practice({ answers: finished, requestId });

      if (result) {
        setStep({ kind: "result", result });
      } else {
        setFailed(true);
      }
    });
  };

  const segments = drill.map((item, position): TaskSegment => {
    const checked = answers[position];

    if (checked === undefined) {
      return position === index ? "current" : "ahead";
    }

    return checked.trim() === item.answer.trim() ? "right" : "wrong";
  });

  return {
    answer,
    check: () => {
      if (step.kind === "question" && answer === null && picked !== null) {
        setAnswers([...answers.slice(0, index), picked]);
      }
    },
    failed,
    index,
    isSaving,
    next: () => {
      setPicked(null);

      if (index + 1 < drill.length) {
        setStep({ index: index + 1, kind: "question" });
        return;
      }

      save(answers);
    },
    pick: (option: string) => {
      if (step.kind === "question" && answer === null) {
        setPicked(option);
      }
    },
    picked: answer ?? picked,
    question,
    retry: () => save(answers),
    segments,
    start: () => {
      setAnswers([]);
      setPicked(null);
      setStep({ index: 0, kind: "question" });
    },
    step,
  };
}
