"use client";

import { useExtracted } from "next-intl";
import { useCheckpointScreen } from "./checkpoint-context";
import { type ResultRows, getEarnedBrainPower, getResultRows } from "./checkpoint-result";

type Outcome = { correct: number; passed: boolean; total: number };

export function useCheckpointOutcome(): Outcome | null {
  const { checkpoint, duel } = useCheckpointScreen();
  const fresh = duel.state.completion?.checkpoint;

  return fresh
    ? { correct: fresh.correct, passed: fresh.passed, total: fresh.total }
    : checkpoint.result;
}

export function useIsWon(): boolean {
  const { checkpoint } = useCheckpointScreen();
  const outcome = useCheckpointOutcome();

  return outcome !== null && (checkpoint.kind === "weekly" || outcome.passed);
}

export function useRetry(): { detail: string | null; passed: boolean; title: string } | null {
  const t = useExtracted();
  const { checkpoint, duel } = useCheckpointScreen();
  const lessons = duel.state.reinforcementLessons;
  const retry = duel.state.completion ? "tomorrow" : checkpoint.retry;

  if (retry === "passed") {
    return { detail: null, passed: true, title: t("You won the rematch") };
  }

  if (!retry) {
    return null;
  }

  return {
    detail: t(
      "{lessons, plural, =0 {} one {After # short lesson on what tripped you up.} other {After # short lessons on what tripped you up.}}",
      { lessons },
    ),
    passed: false,
    title: retry === "tomorrow" ? t("Rematch tomorrow") : t("Rematch next time you study"),
  };
}

export function useResultRows(): ResultRows {
  const { checkpoint } = useCheckpointScreen();
  const won = useIsWon();
  const retry = useRetry();

  return getResultRows({ checkpoint, hasRetry: retry !== null, won });
}

export function useEarnedBrainPower(): number {
  const { checkpoint, duel } = useCheckpointScreen();
  const won = useIsWon();

  return getEarnedBrainPower({
    completion: duel.state.completion,
    prize: checkpoint.reward.brainPower,
    won,
  });
}
