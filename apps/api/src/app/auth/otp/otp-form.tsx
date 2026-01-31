"use client";

import { OTPError, OTPForm as OTPFormContainer, OTPInput, OTPSubmit } from "@/components/otp";
import { authClient } from "@zoonk/core/auth/client";
import { parseFormField } from "@zoonk/utils/form";
import { useExtracted } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function OTPForm({ email, redirectTo }: { email: string; redirectTo: string }) {
  const router = useRouter();
  const t = useExtracted();
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");

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
      setState("error");
      return;
    }

    setState("idle");

    router.push(`/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`);
  };

  return (
    <OTPFormContainer onSubmit={handleSubmit}>
      <OTPInput />
      <OTPError hasError={state === "error"}>
        {t("The code you entered is incorrect. Please try again or contact hello@zoonk.com")}
      </OTPError>

      <OTPSubmit isLoading={state === "pending"}>{t("Continue")}</OTPSubmit>
    </OTPFormContainer>
  );
}
