"use server";

import { cancelWebPlus } from "@zoonk/core/subscriptions/web-plus-cancellation";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

export type CancelPlusResult = "canceled" | "failed" | "unavailable";

export async function cancelPlusAction(): Promise<CancelPlusResult> {
  const { data, error } = await safeAsync(() => cancelWebPlus());

  if (error) {
    logError("[cancelPlusAction] Failed to cancel Plus:", error);
    return "failed";
  }

  return data?.status === "canceled" ? "canceled" : "unavailable";
}
