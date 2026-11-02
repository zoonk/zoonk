"use client";

import {
  type PlanTimeAdvice,
  type PlanTimeAdviceInput,
  type PlanTimeToCover,
  type PlanTimeToCoverInput,
  planTimeAdviceSchema,
  planTimeToCoverSchema,
} from "@zoonk/core/plans/time-advice-contract";
import { postFromBrowser } from "../api/browser-api";

/** From the browser: the question asks again until the plan is built, and a Server Action would keep Continue busy. */
export async function getGoalTimeAdvice({
  dailyMinutes,
  fullCourse,
  goalId,
  studyDays,
  weekendMinutes,
}: PlanTimeAdviceInput & { goalId: string; studyDays: number[] }): Promise<PlanTimeAdvice | null> {
  const response = await postFromBrowser({
    body: { dailyMinutes, fullCourse, studyDays, weekendMinutes },
    path: `/v1/goals/${goalId}/plan/time-advice`,
  });

  if (!response?.ok) {
    return null;
  }

  return planTimeAdviceSchema.safeParse(await response.json().catch(() => null)).data ?? null;
}

/** Not a Server Action, so it never refreshes the page or its prefetched links: it changes nothing. */
export async function findGoalTimeToCover({
  goalId,
  studyDays,
  weekendMinutes,
}: PlanTimeToCoverInput & { goalId: string }): Promise<PlanTimeToCover | null> {
  const response = await postFromBrowser({
    body: { studyDays, weekendMinutes },
    path: `/v1/goals/${goalId}/plan/time-to-cover`,
  });

  if (!response?.ok) {
    return null;
  }

  return planTimeToCoverSchema.safeParse(await response.json().catch(() => null)).data ?? null;
}
