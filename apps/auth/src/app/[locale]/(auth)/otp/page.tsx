import { buttonVariants } from "@zoonk/ui/components/button";
import {
  OTP,
  OTPDescription,
  OTPHeader,
  OTPTitle,
} from "@zoonk/ui/patterns/auth/otp";
import { sanitizeRedirectUrl } from "@zoonk/utils/auth-url";
import { getExtracted } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { OTPForm } from "./otp-form";

export default async function OTPPage({
  searchParams,
}: PageProps<"/[locale]/otp">) {
  const { email, redirectTo } = await searchParams;
  const t = await getExtracted();

  // Validate and sanitize the redirectTo parameter
  const safeRedirectTo = sanitizeRedirectUrl(
    redirectTo ? String(redirectTo) : undefined,
  );

  return (
    <OTP>
      <OTPHeader>
        <OTPTitle>{t("Check your email")}</OTPTitle>

        <OTPDescription>
          {t("Enter the code we sent to {email}:", { email: String(email) })}
        </OTPDescription>
      </OTPHeader>

      <OTPForm email={String(email)} redirectTo={safeRedirectTo ?? undefined} />

      <Link
        className={buttonVariants({ variant: "link" })}
        href={{
          pathname: "/login",
          query: safeRedirectTo ? { redirectTo: safeRedirectTo } : undefined,
        }}
      >
        {t("Change email")}
      </Link>
    </OTP>
  );
}
