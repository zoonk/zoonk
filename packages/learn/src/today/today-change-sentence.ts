"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useChangeSentence } from "../plan/use-change-sentence";
import { countsByDate } from "../plan/use-estimate-sentence";
import { useTodayScreen } from "./today-context";

/** The goal's date while it's still ahead, as its ISO day; null without one or once it came. */
function useTodayDateAhead(): string | null {
  const { today } = useTodayScreen();

  return (today.goal.daysLeft ?? 0) > 0
    ? (today.goal.targetDate?.toISOString().slice(0, "YYYY-MM-DD".length) ?? null)
    : null;
}

/**
 * Whether a change Today shows counts its lessons against the goal's date ahead, as its sentence
 * does (`useEstimateSentence`), and its diff follows it. A proposal says what it does in the words
 * it has everywhere; a change the plan made on its own without a date ahead (none, past it, an
 * exam studied past it) keeps every lesson, so the goal only has fewer or more.
 */
export function useTodayCountsByDate() {
  const dateAhead = useTodayDateAhead();

  return (change: Pick<PlanChangeView, "effect" | "status">): boolean =>
    change.status === "proposed" || countsByDate(change.effect, dateAhead);
}

/** What a suggestion does, in the plan's own words, its lessons counted against the date ahead. */
export function useTodayChangeSentence() {
  const targetDate = useTodayDateAhead();
  return useChangeSentence({ targetDate });
}
