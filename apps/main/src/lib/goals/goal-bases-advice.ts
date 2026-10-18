"use client";

import {
  type PlanBasesAdvice,
  planBasesAdviceSchema,
} from "@zoonk/core/plans/bases-advice-contract";
import { postFromBrowser } from "../api/browser-api";

/**
 * What the app recommends for the plan's bases, when the learner taps "Get a recommendation" (see
 * `PlanBasesAdvice`). Posted to the API from the browser: it plans the goal with every base in
 * depth, and as no Server Action it never refreshes the page, since it changes nothing. Null when
 * it couldn't be read.
 */
export async function getGoalBasesAdvice(goalId: string): Promise<PlanBasesAdvice | null> {
  const response = await postFromBrowser({ path: `/v1/goals/${goalId}/plan/bases-advice` });

  if (!response?.ok) {
    return null;
  }

  return planBasesAdviceSchema.safeParse(await response.json().catch(() => null)).data ?? null;
}
