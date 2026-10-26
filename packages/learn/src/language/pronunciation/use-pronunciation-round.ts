"use client";

import {
  type PronunciationAnswerGrade,
  type PronunciationReviewsView,
  type PronunciationRoundResult,
} from "@zoonk/core/language/pronunciation/contract";
import { useMemo, useState, useTransition } from "react";
import { type TaskSegment } from "../../_components/task-header";

/**
 * What the host's grader returns for one recording: `signUpRequired` asks a guest to create an
 * account once the day's AI budget all guests share is spent.
 */
export type PronunciationAnswerOutcome =
  | { grade: PronunciationAnswerGrade; status: "graded" }
  | { status: "failed" | "noSpeech" | "signUpRequired" };

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
  | { kind: "ready"; notice: PronunciationNotice | null }
  | { grade: PronunciationAnswerGrade; kind: "graded" };

type RoundStep =
  | { index: number; kind: "word"; word: WordState }
  | { kind: "result"; result: PronunciationRoundResult | null };

/** Why the last recording wasn't graded. */
export type PronunciationNotice = "failed" | "noSpeech" | "signUpRequired";

const READY: WordState = { kind: "ready", notice: null };

/**
 * One round of pronunciation reviews: each word is heard, said and graded before the next one; a
 * word that still sounds different can be tried again. The round is counted once, at the end, and
 * only when at least one word was said.
 */
export function usePronunciationRound({
  actions,
  words: initialWords,
}: {
  actions: PronunciationRoundActions;
  words: PronunciationReviewsView["words"];
}) {
  /** Grading refreshes the due list, but the active round must keep its original word cohort. */
  // oxlint-disable-next-line react/hook-use-state -- The round's cohort is immutable after it starts.
  const [words] = useState(initialWords);
  const roundId = useMemo(() => crypto.randomUUID(), []);
  const [step, setStep] = useState<RoundStep>({ index: 0, kind: "word", word: READY });
  const [answered, setAnswered] = useState(0);
  // How each word went, by its place in the round: its last grade, or skipped.
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
    // A word left without a grade was skipped: it fills in quietly, without a verdict.
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
      // A request that didn't get through says so, and the word waits to be said again.
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

  // One segment per word in the header: blue once it sounded right, red when it didn't yet,
  // quiet if skipped; otherwise the word in view, then the ones ahead.
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
      // Trying again starts the word over, so its segment waits for the new grade.
      setOutcomes(({ [index]: _retried, ...others }) => others);
      setStep({ index, kind: "word", word: READY });
    },
  };
}
