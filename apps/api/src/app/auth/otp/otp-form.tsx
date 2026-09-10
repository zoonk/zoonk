"use client";

import {
  OTPActions,
  OTPError,
  OTPForm as OTPFormContainer,
  OTPInput,
  OTPSubmit,
} from "@/components/otp";
import { authClient } from "@zoonk/auth/client";
import { DISPOSABLE_EMAIL_ERROR_CODE } from "@zoonk/auth/email-signup-contract";
import { parseFormField } from "@zoonk/utils/form";
import { useExtracted } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChangeEmailLink } from "./change-email-link";

export function OTPForm({ email, redirectTo }: { email: string; redirectTo: string }) {
  const router = useRouter();
  const t = useExtracted();
  const [state, setState] = useState<"idle" | "pending" | "error" | "disposableEmail">("idle");

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("pending");

    const formData = new FormData(event.currentTarget);
    const otp = parseFormField(formData, "otp");

    if (!otp) {
      setState("error");
      return;
    }

    const { error } = await authClient.signIn.emailOtp({ email, otp });

    if (error) {
      setState(error.code === DISPOSABLE_EMAIL_ERROR_CODE ? "disposableEmail" : "error");
      return;
    }

    setState("idle");

    router.push(`/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`);
  };

  return (
    <OTPFormContainer onSubmit={handleSubmit}>
      <OTPInput />
      <OTPError hasError={state === "error" || state === "disposableEmail"}>
        {state === "disposableEmail"
          ? t("Temporary email addresses aren't supported. Use another email or a privacy alias.")
          : t("The code you entered is incorrect. Please try again or contact hello@zoonk.com")}
      </OTPError>

      <OTPActions>
        <OTPSubmit isLoading={state === "pending"}>{t("Continue")}</OTPSubmit>
        <ChangeEmailLink redirectTo={redirectTo}>{t("Change email")}</ChangeEmailLink>
      </OTPActions>
    </OTPFormContainer>
  );
}
