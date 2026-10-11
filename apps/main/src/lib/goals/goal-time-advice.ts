"use client";

import {
  type PlanTimeAdvice,
  type PlanTimeAdviceInput,
  planTimeAdviceSchema,
} from "@zoonk/core/plans/time-advice-contract";
import { getFromBrowser } from "../api/browser-api";

/**
 * The daily time a goal's plan needs in the week onboarding's time question shows (its study days,
 * and the weekend's own time when it has one). Read from the API in the browser: the question asks
 * again until the plan is built, and a Server Action would keep its Continue busy while each read
 * waits. Null when it couldn't be read.
 */
export async function getGoalTimeAdvice({
  goalId,
  studyDays,
  weekendMinutes,
}: PlanTimeAdviceInput & { goalId: string; studyDays: number[] }): Promise<PlanTimeAdvice | null> {
  const query = new URLSearchParams({
    studyDays: studyDays.join(","),
    ...(weekendMinutes === undefined ? {} : { weekendMinutes: String(weekendMinutes) }),
  });

  const response = await getFromBrowser(`/v1/goals/${goalId}/plan/time-advice?${query}`);

  if (!response?.ok) {
    return null;
  }

  return planTimeAdviceSchema.safeParse(await response.json().catch(() => null)).data ?? null;
}
