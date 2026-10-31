"use server";

import {
  type WebPlusCancellationOutcome,
  cancelWebPlus,
} from "@zoonk/core/subscriptions/web-plus-cancellation";
import { safeAsync } from "@zoonk/utils/error";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";

const localeSchema = z.enum(SUPPORTED_LOCALES);

export type CancelPlusResult =
  | Extract<WebPlusCancellationOutcome, { status: "canceled" }>
  | { status: "failed" | "unavailable" };

/** Server Actions can't read the page's `[lang]`, so the page sends it for the receipt's language. */
export async function cancelPlusAction({
  locale,
  withdraw,
}: {
  locale: unknown;
  withdraw: unknown;
}): Promise<CancelPlusResult> {
  const { data, error } = await safeAsync(() =>
    cancelWebPlus({
      locale: localeSchema.safeParse(locale).data ?? DEFAULT_LOCALE,
      withdraw: withdraw === true,
    }),
  );

  if (error) {
    logError("[cancelPlusAction] Failed to cancel Plus:", error);
    return { status: "failed" };
  }

  return data ?? { status: "unavailable" };
}
