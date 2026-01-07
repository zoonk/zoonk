"use server";

import { auth } from "@zoonk/core/auth";
import { safeAsync } from "@zoonk/utils/error";
import { headers } from "next/headers";

export type TokenResult =
  | { success: true; url: string }
  | { success: false; error: "UNTRUSTED_ORIGIN" };

export async function createOneTimeTokenAction(
  redirectTo: string,
): Promise<TokenResult> {
  const reqHeaders = await headers();

  // First, validate that the redirect URL is a trusted origin
  const { error: validationError } = await safeAsync(
    async () =>
      await auth.api.validateTrustedOrigin({
        body: { url: redirectTo },
        headers: reqHeaders,
      }),
  );

  if (validationError) {
    console.error("Untrusted origin:", JSON.stringify(redirectTo));
    return { error: "UNTRUSTED_ORIGIN", success: false };
  }

  // If trusted, generate the one-time token
  const { data, error } = await safeAsync(
    async () =>
      await auth.api.generateOneTimeToken({
        headers: reqHeaders,
      }),
  );

  if (error) {
    console.error("Error generating one-time token:", error);
    return { error: "UNTRUSTED_ORIGIN", success: false };
  }

  const redirectUrl = new URL(redirectTo);
  redirectUrl.searchParams.set("token", data?.token ?? "");

  return { success: true, url: redirectUrl.toString() };
}
