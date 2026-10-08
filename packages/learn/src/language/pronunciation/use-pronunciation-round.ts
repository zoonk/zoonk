"use client";

import {
  type PronunciationAnswerGrade,
  type PronunciationReviewsView,
  type PronunciationRoundResult,
} from "@zoonk/core/language/pronunciation/contract";
import { useMemo, useState, useTransition } from "react";

/** What the host's grader returns for one recording. */
export type PronunciationAnswerOutcome =
  | { grade: PronunciationAnswerGrade; status: "graded" }
  | { status: "failed" | "noSpeech" };

/** The host saves answers and the round through core; null when the round didn't go through. */
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
  | { kind: "ready"; notice: "failed" | "noSpeech" | null }
  | { grade: PronunciationAnswerGrade; kind: "graded" };

type RoundStep =
  | { index: number; kind: "word"; word: WordState }
  | { kind: "result"; result: PronunciationRoundResult | null };

const READY: WordState = { kind: "ready", notice: null };

/**
 * One round of pronunciation reviews: each word is heard, said and graded before the next one; a
 * word that still sounds different can be tried again. The round is counted once, at the end, and
 * only when at least one word was said.
 */
export function usePronunciationRound({
  actions,
  words,
}: {
  actions: PronunciationRoundActions;
  words: PronunciationReviewsView["words"];
}) {
  const roundId = useMemo(() => crypto.randomUUID(), []);
  const [step, setStep] = useState<RoundStep>({ index: 0, kind: "word", word: READY });
  const [answered, setAnswered] = useState(0);
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
      const result = await actions.finish(roundId);

      if (result) {
        setStep({ kind: "result", result });
      } else {
        setFailed(true);
      }
    });
  };

  const next = () => {
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
      const outcome = await actions.answer({ audio, durationMs, reviewId: current.id, roundId });

      if (outcome.status === "graded") {
        setAnswered((count) => count + 1);
        setStep({ index, kind: "word", word: { grade: outcome.grade, kind: "graded" } });
        return;
      }

      setStep({ index, kind: "word", word: { kind: "ready", notice: outcome.status } });
    });
  };

  return {
    current,
    failed,
    index,
    isPending,
    next,
    record,
    retryFinish: () => finish(true),
    step,
    tryAgain: () => setStep({ index, kind: "word", word: READY }),
  };
}
