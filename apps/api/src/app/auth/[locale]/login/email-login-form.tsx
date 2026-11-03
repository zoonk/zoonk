"use client";

import {
  LoginEmailInput,
  LoginEmailLabel,
  LoginError,
  LoginField,
  LoginForm,
  LoginSubmit,
} from "@/components/login";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { useExtracted } from "next-intl";
import { useActionState, useRef } from "react";
import { sendVerificationOTPAction } from "./actions";
import { readPageRedirectTo } from "./page-url";

const emailErrorId = "login-email-error";
const initialEmailLoginState = { status: "idle" as const };

export function EmailLoginForm({ locale }: { locale: SupportedLocale }) {
  const t = useExtracted();
  const redirectToRef = useRef<HTMLInputElement>(null);
  const [state, formAction] = useActionState(sendVerificationOTPAction, initialEmailLoginState);
  const hasError = state.status !== "idle";

  const errorMessage = {
    disposableEmail: t(
      "Temporary email addresses aren't supported. Use another email or a privacy alias.",
    ),
    error: t("There was an error signing you in. Please try again or contact hello@zoonk.com"),
    idle: "",
    invalidEmail: t("Enter a valid email address"),
    rateLimited: t("Too many tries. Wait a minute, then try again."),
  }[state.status];

  return (
    <LoginForm
      action={formAction}
      // React reads the form's data after this runs, so it carries the address the form is on.
      onSubmit={() => {
        if (redirectToRef.current) {
          redirectToRef.current.value = readPageRedirectTo() ?? "";
        }
      }}
    >
      <input name="locale" type="hidden" value={locale} />
      <input name="redirectTo" ref={redirectToRef} type="hidden" />

      <LoginField>
        <LoginEmailLabel>{t("Email")}</LoginEmailLabel>
        <LoginEmailInput
          aria-describedby={hasError ? emailErrorId : undefined}
          aria-invalid={hasError}
          defaultValue={state.email}
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
