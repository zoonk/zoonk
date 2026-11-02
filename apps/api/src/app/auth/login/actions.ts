"use server";

import { DISPOSABLE_EMAIL_ERROR_CODE } from "@zoonk/auth/email-signup-contract";
import { getAuthError } from "@zoonk/auth/errors";
import { createEmailSignInCode } from "@zoonk/auth/native-sessions";
import { isLocalhostSupported } from "@zoonk/utils/environment";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOtpHref } from "../_utils/auth-redirect";

type VerificationOTPState = { status: "idle" | "invalidEmail" | "disposableEmail" | "error" };

const CLIENT_ERROR = 400;
const SERVER_ERROR = 500;

/**
 * Better Auth's server-side email validation is stricter than the browser's, so an email it rejects
 * becomes a form error instead of a Server Components crash, as does a request it refuses (BotID, its
 * rate limit).
 */
function getExpectedVerificationOTPErrorState(error: unknown): VerificationOTPState | null {
  const authError = getAuthError(error);

  if (authError?.code === DISPOSABLE_EMAIL_ERROR_CODE) {
    return { status: "disposableEmail" };
  }

  if (authError?.code === "INVALID_EMAIL" || authError?.message === "Invalid email") {
    return { status: "invalidEmail" };
  }

  const statusCode = authError?.statusCode ?? SERVER_ERROR;

  return statusCode >= CLIENT_ERROR && statusCode < SERVER_ERROR ? { status: "error" } : null;
}

/** A Server Action has no request URL; Better Auth resolves its host from the headers. */
async function sendSignInCode(email: string) {
  const requestHeaders = await headers();
  const protocol = isLocalhostSupported() ? "http" : "https";

  await createEmailSignInCode({
    email,
    headers: requestHeaders,
    requestURL: `${protocol}://${requestHeaders.get("host")}`,
  });
}

export async function sendVerificationOTPAction(
  _previousState: VerificationOTPState,
  formData: FormData,
): Promise<VerificationOTPState> {
  const email = parseFormField(formData, "email");
  const redirectTo = parseFormField(formData, "redirectTo");

  if (!email) {
    return { status: "invalidEmail" };
  }

  // Through Better Auth's handler, as the apps' route is, so its BotID check and rate limit apply.
  const { error } = await safeAsync(() => sendSignInCode(email));

  if (error) {
    const expectedState = getExpectedVerificationOTPErrorState(error);

    if (expectedState) {
      return expectedState;
    }

    throw error;
  }

  redirect(getOtpHref({ email, redirectTo }));
}
