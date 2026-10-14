import "server-only";
import { auth } from "@zoonk/auth";
import { getAuthError } from "@zoonk/auth/errors";
import { safeAsync } from "@zoonk/utils/error";
import { headers } from "next/headers";

/**
 * Whether sign-in may send the session to `redirectTo`: it must be one of Zoonk's apps. A failure
 * other than an untrusted origin (a session or storage problem) is never mistaken for one.
 */
export async function isTrustedRedirect(redirectTo: string): Promise<boolean> {
  if (!URL.canParse(redirectTo)) {
    return false;
  }

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

/** The app's callback with a one-time token for this session, which the app redeems for its own. */
export async function createOneTimeTokenUrl(
  redirectTo: string,
): Promise<{ success: true; url: string } | { success: false; error: "UNTRUSTED_ORIGIN" }> {
  if (!(await isTrustedRedirect(redirectTo))) {
    return { error: "UNTRUSTED_ORIGIN", success: false };
  }

  const { token } = await auth.api.generateOneTimeToken({ headers: await headers() });
  const redirectUrl = new URL(redirectTo);
  redirectUrl.searchParams.set("token", token);

  return { success: true, url: redirectUrl.toString() };
}
