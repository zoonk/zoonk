"use client";

import { useExtracted } from "next-intl";
import { useCheckpointScreen } from "./checkpoint-context";

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

export function useRetry(): { detail: string; passed: boolean; title: string } | null {
  const t = useExtracted();
  const { checkpoint, duel } = useCheckpointScreen();
  const lessons = duel.state.reinforcementLessons;
  const retry = duel.state.completion ? "tomorrow" : checkpoint.retry;

  if (retry === "passed") {
    return {
      detail: t("This phase is complete."),
      passed: true,
      title: t("Passed on a later try"),
    };
  }

  if (!retry) {
    return null;
  }

  return {
    detail: t(
      "{lessons, plural, =0 {Nothing is lost.} one {After # short lesson on what tripped you up. Nothing is lost.} other {After # short lessons on what tripped you up. Nothing is lost.}}",
      { lessons },
    ),
    passed: false,
    title: retry === "tomorrow" ? t("New try tomorrow") : t("New try in your next session"),
  };
}
