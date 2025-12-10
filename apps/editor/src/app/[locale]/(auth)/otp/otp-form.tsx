"use client";

import { authClient } from "@zoonk/auth/client";
import {
  OTPError,
  OTPForm as OTPFormContainer,
  OTPInput,
  OTPSubmit,
} from "@zoonk/ui/patterns/auth/otp";
import { parseFormField } from "@zoonk/utils/form";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { useState } from "react";

type FormState = "idle" | "pending" | "error";

type OTPFormProps = {
  email: string;
};

export function OTPForm({ email }: OTPFormProps) {
  const { push } = useRouter();
  const t = useExtracted();
  const [state, setState] = useState<FormState>("idle");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const otp = parseFormField(formData, "otp");

    if (!otp) {
      setState("error");
      return;
    }

    const { data, error } = await authClient.signIn.emailOtp({ email, otp });

    setState(error ? "error" : "idle");

    if (data) {
      push("/");
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
