import { OTP, OTPDescription, OTPHeader, OTPTitle } from "@/components/otp";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getExtracted } from "next-intl/server";
import Link from "next/link";
import { OTPForm } from "./otp-form";

export default async function OTPPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; redirectTo?: string }>;
}) {
  const { email, redirectTo } = await searchParams;
  const t = await getExtracted();

  return (
    <OTP>
      <OTPHeader>
        <OTPTitle>{t("Check your email")}</OTPTitle>

        <OTPDescription>
          {t("Enter the code we sent to {email}:", { email: String(email) })}
        </OTPDescription>
      </OTPHeader>

      <OTPForm email={String(email)} redirectTo={String(redirectTo)} />

      <Link
        className={buttonVariants({ variant: "link" })}
        href={{
          pathname: "/auth/login",
          query: { redirectTo: String(redirectTo) },
        }}
      >
        {t("Change email")}
      </Link>
    </OTP>
  );
}
