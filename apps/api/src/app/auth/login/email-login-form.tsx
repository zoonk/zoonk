"use client";

import {
  LoginEmailInput,
  LoginEmailLabel,
  LoginError,
  LoginField,
  LoginForm,
  LoginSubmit,
} from "@/components/login";
import { useExtracted } from "next-intl";
import { useActionState } from "react";
import { sendVerificationOTPAction } from "./actions";

const emailErrorId = "login-email-error";
const initialEmailLoginState = { status: "idle" as const };

/**
 * Owns the interactive email form because invalid-email feedback comes from
 * the Server Action result after Better Auth validates the submitted value.
 * Keeping this as a focused client component lets the login page itself stay a
 * Server Component while still showing recoverable form errors.
 */
export function EmailLoginForm({ redirectTo }: { redirectTo?: string }) {
  const t = useExtracted();
  const [state, formAction] = useActionState(sendVerificationOTPAction, initialEmailLoginState);
  const hasEmailError = state.status === "invalidEmail";
  const hasGenericError = state.status === "error";
  const hasError = hasEmailError || hasGenericError;

  return (
    <LoginForm action={formAction}>
      <input name="redirectTo" type="hidden" value={redirectTo ?? ""} />

      <LoginField>
        <LoginEmailLabel>{t("Email")}</LoginEmailLabel>
        <LoginEmailInput
          aria-describedby={hasError ? emailErrorId : undefined}
          aria-invalid={hasError}
          placeholder={t("me@gmail.com")}
        />
      </LoginField>

      <LoginError aria-live="polite" hasError={hasError} id={emailErrorId}>
        {hasEmailError
          ? t("Enter a valid email address")
          : t("There was an error signing you in. Please try again or contact hello@zoonk.com")}
      </LoginError>

      <LoginSubmit>{t("Continue")}</LoginSubmit>
    </LoginForm>
  );
}
