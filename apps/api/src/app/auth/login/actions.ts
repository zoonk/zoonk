"use server";

import { getBetterAuthError } from "@/lib/better-auth-errors";
import { sendVerificationOTP } from "@zoonk/core/users/otp/send";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type VerificationOTPState = { status: "idle" | "invalidEmail" | "error" };

/**
 * Keeps Better Auth's stricter server-side email validation from becoming a
 * Server Components crash. Browser validation catches common invalid emails,
 * but direct POSTs and embedded browsers can still submit values Better Auth
 * rejects, so the login form needs a normal recoverable state for that case.
 */
function getExpectedVerificationOTPErrorState(error: unknown): VerificationOTPState | null {
  const authError = getBetterAuthError(error);

  if (authError?.code === "INVALID_EMAIL" || authError?.message === "Invalid email") {
    return { status: "invalidEmail" };
  }

  return null;
}

/**
 * Starts the email OTP login flow while returning form state for validation
 * errors users can fix immediately. Successful submissions still redirect to
 * the OTP page, while unexpected auth failures keep throwing so production
 * monitoring catches real service problems.
 */
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

  const params = new URLSearchParams({ email });

  if (redirectTo) {
    params.set("redirectTo", redirectTo);
  }

  redirect(`/auth/otp?${params.toString()}`);
}
