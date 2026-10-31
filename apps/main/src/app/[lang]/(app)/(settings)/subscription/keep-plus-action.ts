"use server";

import { keepWebPlus } from "@zoonk/core/subscriptions/web-plus-cancellation";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

export type KeepPlusResult = "failed" | "kept" | "unavailable";

export async function keepPlusAction(): Promise<KeepPlusResult> {
  const { data, error } = await safeAsync(() => keepWebPlus());

  if (error) {
    logError("[keepPlusAction] Failed to keep Plus:", error);
    return "failed";
  }

  return data?.status ?? "unavailable";
}
