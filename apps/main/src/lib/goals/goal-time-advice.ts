"use client";

import {
  type PlanTimeAdvice,
  type PlanTimeAdviceInput,
  type PlanTimeToCover,
  type PlanTimeToCoverInput,
  planTimeAdviceSchema,
  planTimeToCoverSchema,
} from "@zoonk/core/plans/time-advice-contract";
import { getFromBrowser, postFromBrowser, readJsonForThisLearner } from "../api/browser-api";

/**
 * The daily time a goal's plan needs in the week onboarding's time question shows (its study days,
 * and the weekend's own time when it has one), and what the time a day picked covers by the goal's
 * date. Read from the API in the browser: the question asks again until the plan is built, and a
 * Server Action would keep its Continue busy while each read waits. Null when it couldn't be read.
 */
export async function getGoalTimeAdvice({
  dailyMinutes,
  goalId,
  studyDays,
  weekendMinutes,
}: PlanTimeAdviceInput & { goalId: string; studyDays: number[] }): Promise<PlanTimeAdvice | null> {
  const query = new URLSearchParams({
    studyDays: studyDays.join(","),
    ...(dailyMinutes === undefined ? {} : { dailyMinutes: String(dailyMinutes) }),
    ...(weekendMinutes === undefined ? {} : { weekendMinutes: String(weekendMinutes) }),
  });

  const response = await getFromBrowser(`/v1/goals/${goalId}/plan/time-advice?${query}`);

  if (!response?.ok) {
    return null;
  }

  return planTimeAdviceSchema.safeParse(await readJsonForThisLearner(response)).data ?? null;
}

/**
 * The daily time that covers the goal's whole plan by its date, found when the learner taps "Find
 * the time that covers everything" (see `PlanTimeToCover`), in the week asked about (the plan's own
 * when absent). Posted to the API from the browser: it plans the goal at each daily time, so it
 * takes a moment, and as no Server Action it never refreshes the page or its prefetched links,
 * since it changes nothing. Null when it couldn't be found.
 */
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

  return planTimeToCoverSchema.safeParse(await readJsonForThisLearner(response)).data ?? null;
}
