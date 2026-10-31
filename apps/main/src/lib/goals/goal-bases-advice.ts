"use client";

import {
  type PlanBasesAdvice,
  planBasesAdviceSchema,
} from "@zoonk/core/plans/bases-advice-contract";
import { postFromBrowser } from "../api/browser-api";

/** Not a Server Action, so it never refreshes the page: it changes nothing. */
export async function getGoalBasesAdvice(goalId: string): Promise<PlanBasesAdvice | null> {
  const response = await postFromBrowser({ path: `/v1/goals/${goalId}/plan/bases-advice` });

  if (!response?.ok) {
    return null;
  }

  return planBasesAdviceSchema.safeParse(await response.json().catch(() => null)).data ?? null;
}
