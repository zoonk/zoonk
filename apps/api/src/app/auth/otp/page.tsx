import { AuthFrame } from "@/components/auth-frame";
import { OTP, OTPDescription, OTPHeader, OTPTitle } from "@/components/otp";
import { getExtracted } from "next-intl/server";
import { redirect } from "next/navigation";
import { getLoginHref, readRedirectTo } from "../_utils/auth-redirect";
import { OTPForm } from "./otp-form";

export default async function OTPPage({ searchParams }: PageProps<"/auth/otp">) {
  const params = await searchParams;
  const redirectTo = readRedirectTo(params.redirectTo);
  const email = typeof params.email === "string" ? params.email : null;

  /** Without an email there's no code to check: start over, still going back to the same app. */
  if (!email) {
    redirect(getLoginHref(redirectTo));
  }

  const t = await getExtracted();

  return (
    <AuthFrame>
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
