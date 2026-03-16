"use server";

import { auth } from "@zoonk/core/auth";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { headers } from "next/headers";

const TRAILING_SLASHES = /\/+$/;

export async function validateTrustedOriginAction(redirectTo: string): Promise<boolean> {
  const reqHeaders = await headers();

  const { error } = await safeAsync(async () =>
    auth.api.validateTrustedOrigin({
      body: { url: redirectTo },
      headers: reqHeaders,
    }),
  );

  return !error;
}

export async function createOneTimeTokenAction(
  redirectTo: string,
): Promise<{ success: true; url: string } | { success: false; error: "UNTRUSTED_ORIGIN" }> {
  const reqHeaders = await headers();

  const { error: validationError } = await safeAsync(async () =>
    auth.api.validateTrustedOrigin({
      body: { url: redirectTo },
      headers: reqHeaders,
    }),
  );

  if (validationError) {
    logError("Untrusted origin:", JSON.stringify(redirectTo));
    return { error: "UNTRUSTED_ORIGIN", success: false };
  }

  const { data, error } = await safeAsync(async () =>
    auth.api.generateOneTimeToken({
      headers: reqHeaders,
    }),
  );

  if (error) {
    logError("Error generating one-time token:", error);
    return { error: "UNTRUSTED_ORIGIN", success: false };
  }

  const redirectUrl = new URL(redirectTo);
  const normalizedPath = redirectUrl.pathname.replace(TRAILING_SLASHES, "");
  redirectUrl.pathname = `${normalizedPath}/${data?.token ?? ""}`;

  return { success: true, url: redirectUrl.toString() };
}
