"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type GoalDateKind, getGoalDateKind } from "../plan/goal-date-kind";
import { useChangeWords } from "../plan/use-change-sentence";
import { useTodayScreen } from "./today-context";

/** A full-course exam plan may grow past its date, so its count isn't one by the date. */
function countsByDate(effect: PlanChangeView["effect"], targetDate: string | null): boolean {
  return targetDate !== null && (!effect?.endDateAfter || effect.endDateAfter <= targetDate);
}

function useTodayDateAhead(): string | null {
  const { today } = useTodayScreen();

  return (today.goal.daysLeft ?? 0) > 0
    ? (today.goal.targetDate?.toISOString().slice(0, "YYYY-MM-DD".length) ?? null)
    : null;
}

export function useTodayCountsByDate() {
  const dateAhead = useTodayDateAhead();

  return (change: Pick<PlanChangeView, "effect" | "status">): boolean =>
    change.status === "proposed" || countsByDate(change.effect, dateAhead);
}

export function useTodayDateKind(): GoalDateKind {
  const { today } = useTodayScreen();
  return getGoalDateKind(today.goal.kind);
}

export function useTodayChangeWords() {
  return useChangeWords({ dateKind: useTodayDateKind() });
}
