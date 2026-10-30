"use client";

import {
  LoginEmailInput,
  LoginEmailLabel,
  LoginError,
  LoginField,
  LoginForm,
  LoginSubmit,
} from "@/components/login";
import { trackEvent } from "@zoonk/core/analytics/client";
import { useExtracted } from "next-intl";
import { useActionState } from "react";
import { sendVerificationOTPAction } from "./actions";

const emailErrorId = "login-email-error";
const initialEmailLoginState = { status: "idle" as const };

export function EmailLoginForm({ redirectTo }: { redirectTo: string | null }) {
  const t = useExtracted();
  const [state, formAction] = useActionState(sendVerificationOTPAction, initialEmailLoginState);
  const hasError = state.status !== "idle";

  const errorMessage = {
    disposableEmail: t(
      "Temporary email addresses aren't supported. Use another email or a privacy alias.",
    ),
    error: t("There was an error signing you in. Please try again or contact hello@zoonk.com"),
    idle: "",
    invalidEmail: t("Enter a valid email address"),
  }[state.status];

  return (
    <LoginForm
      action={formAction}
      onSubmit={() => trackEvent({ name: "Sign In Method Chosen", properties: { method: "otp" } })}
    >
      <input name="redirectTo" type="hidden" value={redirectTo ?? ""} />

      <LoginField>
        <LoginEmailLabel>{t("Email")}</LoginEmailLabel>
        <LoginEmailInput
          aria-describedby={hasError ? emailErrorId : undefined}
          aria-invalid={hasError}
          placeholder={t({
            description:
              "An example address shown in the empty email field. Keep it as written, like the app's other example addresses.",
            message: "me@gmail.com",
          })}
        />
      </LoginField>

      <LoginError aria-live="polite" hasError={hasError} id={emailErrorId}>
        {errorMessage}
      </LoginError>

      <LoginSubmit>{t("Continue")}</LoginSubmit>
    </LoginForm>
  );
}
