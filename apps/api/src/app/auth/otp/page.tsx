import { OTP, OTPDescription, OTPHeader, OTPTitle } from "@/components/otp";
import { getExtracted } from "next-intl/server";
import { OTPForm } from "./otp-form";

export default async function OTPPage({ searchParams }: PageProps<"/auth/otp">) {
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
    </OTP>
  );
}
