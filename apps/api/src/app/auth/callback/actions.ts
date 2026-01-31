"use server";

import { auth } from "@zoonk/core/auth";
import { safeAsync } from "@zoonk/utils/error";
import { headers } from "next/headers";

const TRAILING_SLASHES = /\/+$/;

export type TokenResult =
  | { success: true; url: string }
  | { success: false; error: "UNTRUSTED_ORIGIN" };

export async function createOneTimeTokenAction(redirectTo: string): Promise<TokenResult> {
  const reqHeaders = await headers();

  const { error: validationError } = await safeAsync(async () =>
    auth.api.validateTrustedOrigin({
      body: { url: redirectTo },
      headers: reqHeaders,
    }),
  );

  if (validationError) {
    console.error("Untrusted origin:", JSON.stringify(redirectTo));
    return { error: "UNTRUSTED_ORIGIN", success: false };
  }

  const { data, error } = await safeAsync(async () =>
    auth.api.generateOneTimeToken({
      headers: reqHeaders,
    }),
  );

  if (error) {
    console.error("Error generating one-time token:", error);
    return { error: "UNTRUSTED_ORIGIN", success: false };
  }

  const redirectUrl = new URL(redirectTo);
  const normalizedPath = redirectUrl.pathname.replace(TRAILING_SLASHES, "");
  redirectUrl.pathname = `${normalizedPath}/${data?.token ?? ""}`;

  return { success: true, url: redirectUrl.toString() };
}
