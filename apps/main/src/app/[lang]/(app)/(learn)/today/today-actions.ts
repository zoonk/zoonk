"use server";

import { acknowledgeTodayPlanChange } from "@zoonk/core/plans/acknowledge-today-change";
import {
  type AcknowledgeTodayPlanChangeInput,
  type AcknowledgeTodayPlanChangeResult,
  acknowledgeTodayPlanChangeInputSchema,
} from "@zoonk/core/plans/today-change-contract";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * "Got it" on Today's plan change, from the learner's tap: a change Today worked out before the
 * day saved it is saved and marked seen at once (`computed`, bound to the revision Today showed
 * it at); a saved one is marked seen (`stored`). It never starts the day. `retryable` when it
 * didn't go through.
 */
export async function acknowledgeTodayPlanChangeAction(
  input: AcknowledgeTodayPlanChangeInput,
): Promise<AcknowledgeTodayPlanChangeResult> {
  const parsed = acknowledgeTodayPlanChangeInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "notFound" };
  }

  const { data, error } = await safeAsync(() => acknowledgeTodayPlanChange(parsed.data));

  if (error) {
    logError("[acknowledgeTodayPlanChangeAction] Failed to acknowledge the plan change:", error);
    return { status: "retryable" };
  }

  return data;
}
