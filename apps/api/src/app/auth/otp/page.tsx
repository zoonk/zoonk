import { AuthFrame } from "@/components/auth-frame";
import { OTP, OTPDescription, OTPHeader, OTPTitle } from "@/components/otp";
import { getExtracted } from "next-intl/server";
import { redirect } from "next/navigation";
import { getLoginHref, readRedirectTo } from "../_utils/auth-redirect";
import { getReturnAppUrl } from "../_utils/return-app";
import { OTPForm } from "./otp-form";

export default async function OTPPage({ searchParams }: PageProps<"/auth/otp">) {
  const params = await searchParams;
  const redirectTo = readRedirectTo(params.redirectTo);
  const email = typeof params.email === "string" ? params.email : null;

  if (!email) {
    redirect(getLoginHref(redirectTo));
  }

  const t = await getExtracted();

  return (
    <AuthFrame appUrl={getReturnAppUrl(redirectTo)}>
      <OTP>
        <OTPHeader>
          <OTPTitle>{t("Check your email")}</OTPTitle>

          <OTPDescription>{t("Enter the code we sent to {email}.", { email })}</OTPDescription>
        </OTPHeader>

        <OTPForm email={email} redirectTo={redirectTo} />
      </OTP>
    </AuthFrame>
  );
}
