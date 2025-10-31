"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { InputError } from "@zoonk/ui/components/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@zoonk/ui/components/input-otp";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/client";

type FormState = "idle" | "pending" | "error";

type OTPFormProps = {
  email: string;
};

export function OTPForm({ email }: OTPFormProps) {
  const { push } = useRouter();
  const t = useTranslations("Auth");
  const [state, setState] = useState<FormState>("idle");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const otp = String(formData.get("otp"));

    const { data, error } = await authClient.signIn.emailOtp({ email, otp });

    setState(error ? "error" : "idle");

    if (data) {
      push("/");
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-bold text-xl">{t("otpTitle")}</h1>
        <p className="text-balance text-center text-sm">
          {t("otpSubtitle", { email })}
        </p>
      </div>

      <form
        className="flex flex-col items-center gap-4"
        onSubmit={handleSubmit}
      >
        <InputOTP maxLength={6} name="otp" pattern="[0-9]*" required>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>

        {state === "error" && <InputError>{t("otpError")}</InputError>}

        <Button disabled={state === "pending"} type="submit">
          {state === "pending" && <Spinner />}
          {t("submit")}
        </Button>

        <Link className={buttonVariants({ variant: "link" })} href="/login">
          {t("changeEmail")}
        </Link>
      </form>
    </div>
  );
}
