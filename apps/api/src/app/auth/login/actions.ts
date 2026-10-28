"use server";

import { DISPOSABLE_EMAIL_ERROR_CODE } from "@zoonk/auth/email-signup-contract";
import { getAuthError } from "@zoonk/auth/errors";
import { sendVerificationOTP } from "@zoonk/core/users/otp/send";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOtpHref } from "../_utils/auth-redirect";

type VerificationOTPState = { status: "idle" | "invalidEmail" | "disposableEmail" | "error" };

/**
 * Better Auth's server-side email validation is stricter than the browser's, so an email it rejects
 * becomes a form error instead of a Server Components crash.
 */
function getExpectedVerificationOTPErrorState(error: unknown): VerificationOTPState | null {
  const authError = getAuthError(error);

  if (authError?.code === DISPOSABLE_EMAIL_ERROR_CODE) {
    return { status: "disposableEmail" };
  }

  if (authError?.code === "INVALID_EMAIL" || authError?.message === "Invalid email") {
    return { status: "invalidEmail" };
  }

  return null;
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

  const { data, error } = await safeAsync(async () =>
    sendVerificationOTP({ email, headers: await headers() }),
  );

  if (error) {
    const expectedState = getExpectedVerificationOTPErrorState(error);

    if (expectedState) {
      return expectedState;
    }

    throw error;
  }

  if (!data.success) {
    return { status: "error" };
  }

  redirect(getOtpHref({ email, redirectTo }));
}
