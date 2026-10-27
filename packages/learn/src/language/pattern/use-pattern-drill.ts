"use client";

import { type MistakePatternView } from "@zoonk/core/language/patterns/contract";
import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { type ProgressCelebration } from "@zoonk/core/sessions/progress-celebration";
import { useMemo, useState, useTransition } from "react";
import { type TaskSegment } from "../../_components/task-header";

/**
 * What the drill earned, from core: right answers of the total, the Brain Power paid, and the
 * level, tenth of Energy and milestone it's celebrated with.
 */
export type PatternPracticeResult = ProgressCelebration & {
  brainPower: number;
  correct: number;
  /** The day's missions the drill completed; null when it completed none. */
  missionMoment?: MissionMomentView | null;
  total: number;
};

/** A finished drill as the host saves it: its answers in order and the drill's own id. */
export type PatternDrillAnswers = { answers: string[]; requestId: string };

type DrillStep =
  | { kind: "intro" }
  | { index: number; kind: "question" }
  | { kind: "result"; result: PatternPracticeResult };

/**
 * The drill's steps: the pattern card, one question per screen, then the result once core has
 * saved every answer. A question is answered as a lesson's is: the learner picks an option (and
 * can change their mind), then Check grades it against the drill and shows why; nothing is saved
 * until the last one.
 */
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

  // Each question's segment in the header: green or red once checked, the one in view, the rest ahead.
  const segments = drill.map((item, position): TaskSegment => {
    const checked = answers[position];

    if (checked === undefined) {
      return position === index ? "current" : "ahead";
    }

    return checked.trim() === item.answer.trim() ? "right" : "wrong";
  });

  return {
    /** The checked answer to the question in view, or null before Check. */
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
    /** The option shown as chosen: the checked answer, or the pick waiting for Check. */
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
