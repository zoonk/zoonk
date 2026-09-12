"use client";

import { safeAsync } from "@zoonk/utils/error";
import { unstable_rethrow } from "next/navigation";

/** Keep form drafts mounted when transport fails, while preserving Next.js navigation. */
export async function runClientAction<Result, Fallback>(
  action: () => Promise<Result>,
  fallback: Fallback,
): Promise<Result | Fallback> {
  const result = await safeAsync(action);

  if (result.error) {
    unstable_rethrow(result.error);
    return fallback;
  }

  return result.data;
}
