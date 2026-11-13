"use client";

import { AuthField, AuthForm, AuthStatus, AuthSubmit } from "@/components/auth-form";
import { LoginEmailInput, LoginEmailLabel } from "@/components/login";
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
    disposableEmail: t("Temporary emails don't work. Use another."),
    error: t("We couldn't log you in. Try again."),
    idle: "",
    invalidEmail: t("Enter a valid email address"),
    rateLimited: t("Too many tries. Try again in a minute."),
  }[state.status];

  return (
    <AuthForm action={formAction}>
      <input name="locale" type="hidden" value={locale} />

      <AuthField>
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
      </AuthField>

      <AuthStatus id={emailErrorId}>{errorMessage}</AuthStatus>
      <AuthSubmit>{t("Continue")}</AuthSubmit>
    </AuthForm>
  );
}
