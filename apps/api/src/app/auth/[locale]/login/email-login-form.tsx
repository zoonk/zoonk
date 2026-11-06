"use client";

import {
  LoginEmailInput,
  LoginEmailLabel,
  LoginError,
  LoginField,
  LoginForm,
  LoginSubmit,
} from "@/components/login";
import { parseFormField } from "@zoonk/utils/form";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { useExtracted } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { useActionState } from "react";
import { type VerificationOTPState, sendVerificationOTPAction } from "./actions";
import { readPageRedirectTo } from "./page-url";

const emailErrorId = "login-email-error";
const initialEmailLoginState: VerificationOTPState = { status: "idle" };

export function EmailLoginForm({ locale }: { locale: SupportedLocale }) {
  const t = useExtracted();

  const [state, formAction] = useActionState(
    (previous: VerificationOTPState, formData: FormData) => {
      formData.set("redirectTo", readPageRedirectTo() ?? "");

      return sendVerificationOTPAction(previous, formData).catch(
        (error: unknown): VerificationOTPState => {
          unstable_rethrow(error);
          return { email: parseFormField(formData, "email") ?? "", status: "error" };
        },
      );
    },
    initialEmailLoginState,
  );

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
    <LoginForm action={formAction}>
      <input name="locale" type="hidden" value={locale} />

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
