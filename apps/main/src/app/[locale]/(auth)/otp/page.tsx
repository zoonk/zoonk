import { buttonVariants } from "@zoonk/ui/components/button";
import {
  OTP,
  OTPDescription,
  OTPHeader,
  OTPTitle,
} from "@zoonk/ui/patterns/auth/otp";
import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { OTPForm } from "./otp-form";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
    nocache: true,
  },
};

export default async function OTPPage({
  searchParams,
}: PageProps<"/[locale]/otp">) {
  const { email } = await searchParams;
  const t = await getExtracted();

  return (
    <OTP>
      <OTPHeader>
        <OTPTitle>{t("Check your email")}</OTPTitle>

        <OTPDescription>
          {t("Enter the code we sent to {email}:", { email: String(email) })}
        </OTPDescription>
      </OTPHeader>

      <OTPForm email={String(email)} />

      <Link className={buttonVariants({ variant: "link" })} href="/login">
        {t("Change email")}
      </Link>
    </OTP>
  );
}
