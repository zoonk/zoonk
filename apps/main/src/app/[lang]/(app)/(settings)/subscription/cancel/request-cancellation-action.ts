"use server";

import { requestWebPlusCancellation } from "@zoonk/core/subscriptions/web-plus-cancellation";
import { webPlusCancellationRequestSchema } from "@zoonk/core/subscriptions/web-plus-cancellation-contract";
import { safeAsync } from "@zoonk/utils/error";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";

const localeSchema = z.enum(SUPPORTED_LOCALES);

const declarationSchema = z.object({
  email: z.email(),
  name: z.string().trim().min(1).max(100),
  request: webPlusCancellationRequestSchema,
});

export type RequestCancellationResult =
  | { status: "received"; receivedAt: Date }
  | { status: "failed" | "invalid" };

/** The same answer whether or not the email has an account, so nobody learns which emails do. */
export async function requestCancellationAction({
  locale,
  ...declaration
}: {
  email: unknown;
  locale: unknown;
  name: unknown;
  request: unknown;
}): Promise<RequestCancellationResult> {
  const parsed = declarationSchema.safeParse(declaration);

  if (!parsed.success) {
    return { status: "invalid" };
  }

  const { data, error } = await safeAsync(() =>
    requestWebPlusCancellation({
      ...parsed.data,
      locale: localeSchema.safeParse(locale).data ?? DEFAULT_LOCALE,
    }),
  );

  if (error) {
    logError("[requestCancellationAction] Failed to take a cancellation:", error);
    return { status: "failed" };
  }

  return data ? { receivedAt: data.receivedAt, status: "received" } : { status: "failed" };
}
