import { buttonVariants } from "@zoonk/ui/components/button";
import {
  OTP,
  OTPDescription,
  OTPHeader,
  OTPTitle,
} from "@zoonk/ui/patterns/auth/otp";
import { getExtracted } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { OTPForm } from "./otp-form";

export default async function OTPPage({
  searchParams,
}: PageProps<"/[locale]/otp">) {
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

      <OTPForm
        email={String(email)}
        redirectTo={redirectTo ? String(redirectTo) : undefined}
      />

      <Link
        className={buttonVariants({ variant: "link" })}
        href={{
          pathname: "/login",
          query: redirectTo ? { redirectTo: String(redirectTo) } : undefined,
        }}
      >
        {t("Change email")}
      </Link>
    </OTP>
  );
}
