"use client";

import { useExtracted } from "next-intl";
import { useCheckpointScreen } from "./checkpoint-context";

type Outcome = { correct: number; passed: boolean; total: number };

/**
 * How it went: from the moment it finished, or from the saved block when reopened later. None when
 * its questions were removed before any was answered: nothing was asked, so there's no verdict.
 */
export function useCheckpointOutcome(): Outcome | null {
  const { checkpoint, duel } = useCheckpointScreen();
  const fresh = duel.state.completion?.checkpoint;

  return fresh
    ? { correct: fresh.correct, passed: fresh.passed, total: fresh.total }
    : checkpoint.result;
}

/**
 * A weekly challenge is done once finished; a phase's Trickster is won or not. Neither is without
 * an outcome.
 */
export function useIsWon(): boolean {
  const { checkpoint } = useCheckpointScreen();
  const outcome = useCheckpointOutcome();

  return outcome !== null && (checkpoint.kind === "weekly" || outcome.passed);
}

/**
 * The new try after a duel not won, as things stand now: tomorrow, back in the plan, or passed on
 * a later try (`passed`).
 */
export function useRetry(): { detail: string; passed: boolean; title: string } | null {
  const t = useExtracted();
  const { checkpoint, duel } = useCheckpointScreen();
  const lessons = duel.state.reinforcementLessons;
  // Right after the duel, its new try is tomorrow.
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
