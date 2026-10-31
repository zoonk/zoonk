"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useChangeSentence } from "../plan/use-change-sentence";
import { countsByDate } from "../plan/use-estimate-sentence";
import { useTodayScreen } from "./today-context";

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

export function useTodayChangeSentence() {
  const targetDate = useTodayDateAhead();
  return useChangeSentence({ targetDate });
}
