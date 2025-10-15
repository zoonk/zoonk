"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { InputError } from "@zoonk/ui/components/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@zoonk/ui/components/input-otp";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Link } from "@/i18n/navigation";
import { emailOTP } from "./actions";

const initialState = {
  error: "",
};

interface OTPFormProps {
  email: string;
}

export function OTPForm({ email }: OTPFormProps) {
  const t = useTranslations("Auth");

  const [state, formAction, _pending] = useActionState(emailOTP, initialState);

  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-bold text-xl">{t("otpTitle")}</h1>
        <p className="text-balance text-center text-sm">
          {t("otpSubtitle", { email })}
        </p>
      </div>

      <form action={formAction} className="flex flex-col items-center gap-4">
        <InputOTP name="otp" maxLength={6} required pattern="[0-9]*">
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>

        <input type="hidden" name="email" value={email} />

        <InputError>{state.error}</InputError>

        <SubmitButton full>{t("submit")}</SubmitButton>

        <Link href="/login" className={buttonVariants({ variant: "link" })}>
          {t("changeEmail")}
        </Link>
      </form>
    </div>
  );
}
