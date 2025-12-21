"use client";

import { authClient } from "@zoonk/auth/client";
import {
  OTPError,
  OTPForm as OTPFormContainer,
  OTPInput,
  OTPSubmit,
} from "@zoonk/ui/patterns/auth/otp";
import { parseFormField } from "@zoonk/utils/form";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

type FormState = "idle" | "pending" | "error";

type OTPFormProps = {
  email: string;
  redirectTo?: string;
};

export function OTPForm({ email, redirectTo }: OTPFormProps) {
  const { push } = useRouter();
  const t = useExtracted();
  const [state, setState] = useState<FormState>("idle");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("pending");

    const formData = new FormData(event.currentTarget);
    const otp = parseFormField(formData, "otp");

    if (!otp) {
      setState("error");
      return;
    }

    const { data, error } = await authClient.signIn.emailOtp({ email, otp });

    if (error) {
      setState("error");
      return;
    }

    setState("idle");

    if (data) {
      // After successful login, redirect to callback to generate OTT
      if (redirectTo) {
        push({
          pathname: "/callback",
          query: { redirectTo },
        });
      } else {
        // No redirect specified, just show success
        push("/callback");
      }
    }
  };

  return (
    <OTPFormContainer onSubmit={handleSubmit}>
      <OTPInput />
      <OTPError hasError={state === "error"}>
        {t(
          "The code you entered is incorrect. Please try again or contact hello@zoonk.com",
        )}
      </OTPError>

      <OTPSubmit isLoading={state === "pending"}>{t("Continue")}</OTPSubmit>
    </OTPFormContainer>
  );
}
