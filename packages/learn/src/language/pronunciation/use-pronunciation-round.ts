"use client";

import {
  type PronunciationAnswerGrade,
  type PronunciationReviewsView,
  type PronunciationRoundResult,
} from "@zoonk/core/language/pronunciation/contract";
import { useMemo, useState, useTransition } from "react";
import { type TaskSegment } from "../../_components/task-header";

export type PronunciationAnswerOutcome =
  | { grade: PronunciationAnswerGrade; status: "graded" }
  | { status: "failed" | "noSpeech" | "signUpRequired" };

/** `finish` resolves to null when the round didn't go through. */
export type PronunciationRoundActions = {
  answer: (input: {
    audio: Blob;
    durationMs: number;
    reviewId: string;
    roundId: string;
  }) => Promise<PronunciationAnswerOutcome>;
  finish: (roundId: string) => Promise<PronunciationRoundResult | null>;
};

type WordState =
  | { kind: "ready"; notice: PronunciationNotice | null }
  | { grade: PronunciationAnswerGrade; kind: "graded" };

type RoundStep =
  | { index: number; kind: "word"; word: WordState }
  | { kind: "result"; result: PronunciationRoundResult | null };

export type PronunciationNotice = "failed" | "noSpeech" | "signUpRequired";

const READY: WordState = { kind: "ready", notice: null };

export function usePronunciationRound({
  actions,
  words: initialWords,
}: {
  actions: PronunciationRoundActions;
  words: PronunciationReviewsView["words"];
}) {
  // oxlint-disable-next-line react/hook-use-state -- The round's cohort is immutable after it starts.
  const [words] = useState(initialWords);
  const roundId = useMemo(() => crypto.randomUUID(), []);
  const [step, setStep] = useState<RoundStep>({ index: 0, kind: "word", word: READY });
  const [answered, setAnswered] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<number, TaskSegment>>({});
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const index = step.kind === "word" ? step.index : words.length;
  const current = words[index];

  const finish = (hasAnswers: boolean) => {
    if (!hasAnswers) {
      setStep({ kind: "result", result: null });
      return;
    }

    setFailed(false);

    startTransition(async () => {
      const result = await actions.finish(roundId).catch(() => null);

      if (result) {
        setStep({ kind: "result", result });
      } else {
        setFailed(true);
      }
    });
  };

  const next = () => {
    setOutcomes((previous) => ({ ...previous, [index]: previous[index] ?? "read" }));

    if (index + 1 < words.length) {
      setStep({ index: index + 1, kind: "word", word: READY });
      return;
    }

    finish(answered > 0);
  };

  const record = ({ audio, durationMs }: { audio: Blob; durationMs: number }) => {
    if (!current) {
      return;
    }

    startTransition(async () => {
      const outcome = await actions
        .answer({ audio, durationMs, reviewId: current.id, roundId })
        .catch((): PronunciationAnswerOutcome => ({ status: "failed" }));

      if (outcome.status === "graded") {
        setAnswered((count) => count + 1);

        setOutcomes((previous) => ({
          ...previous,
          [index]: outcome.grade.isCorrect ? "right" : "wrong",
        }));

        setStep({ index, kind: "word", word: { grade: outcome.grade, kind: "graded" } });
        return;
      }

      setStep({ index, kind: "word", word: { kind: "ready", notice: outcome.status } });
    });
  };

  const segments = words.map(
    (_, position): TaskSegment => outcomes[position] ?? (position === index ? "current" : "ahead"),
  );

  return {
    current,
    failed,
    index,
    isPending,
    next,
    record,
    retryFinish: () => finish(true),
    segments,
    step,
    tryAgain: () => {
      setOutcomes(({ [index]: _retried, ...others }) => others);
      setStep({ index, kind: "word", word: READY });
    },
  };
}
