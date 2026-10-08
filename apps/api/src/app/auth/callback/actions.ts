"use server";

import { auth } from "@zoonk/auth";
import { getAuthError } from "@zoonk/auth/errors";
import { safeAsync } from "@zoonk/utils/error";
import { headers } from "next/headers";

export async function validateTrustedOriginAction(redirectTo: string): Promise<boolean> {
  const reqHeaders = await headers();

  const { error } = await safeAsync(async () =>
    auth.api.validateTrustedOrigin({ body: { url: redirectTo }, headers: reqHeaders }),
  );

  if (!error) {
    return true;
  }

  if (getAuthError(error)?.message === "UNTRUSTED_ORIGIN") {
    return false;
  }

  throw error;
}

export async function createOneTimeTokenAction(
  redirectTo: string,
): Promise<{ success: true; url: string } | { success: false; error: "UNTRUSTED_ORIGIN" }> {
  if (!(await validateTrustedOriginAction(redirectTo))) {
    return { error: "UNTRUSTED_ORIGIN", success: false };
  }

  const { token } = await auth.api.generateOneTimeToken({ headers: await headers() });
  const redirectUrl = new URL(redirectTo);
  redirectUrl.searchParams.set("token", token);

  return { success: true, url: redirectUrl.toString() };
}
