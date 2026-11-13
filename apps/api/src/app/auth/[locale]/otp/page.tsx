import { AuthDescription, AuthHeader, AuthTitle } from "@/components/auth-form";
import { AuthFrame } from "@/components/auth-frame";
import { OTP, OTPDescriptionSkeleton, OTPFormSkeleton } from "@/components/otp";
import { getAuthPageLocale } from "@/i18n/page-locale";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getLoginHref, readRedirectTo } from "../../_utils/auth-redirect";
import { getReturnAppUrl } from "../../_utils/return-app";
import { OTPForm } from "./otp-form";

type OTPPageProps = PageProps<"/auth/[locale]/otp">;

async function readCodeRequest(searchParams: OTPPageProps["searchParams"]) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : null;

  return { email, redirectTo: readRedirectTo(params.redirectTo) };
}

async function CodeSentTo({ searchParams }: Pick<OTPPageProps, "searchParams">) {
  const [t, { email }] = await Promise.all([getExtracted(), readCodeRequest(searchParams)]);

  return email ? (
    <AuthDescription>
      {t.rich("Enter the code we sent to <address>{email}</address>.", {
        address: emailAddress(email),
        email,
      })}
    </AuthDescription>
  ) : null;
}

/** An address that has to wrap breaks only before its "@", never at a hyphen or dot inside it. */
function emailAddress(email: string) {
  const at = email.lastIndexOf("@");

  return function EmailAddress() {
    if (at <= 0) {
      return <span className="whitespace-nowrap">{email}</span>;
    }

    return (
      <>
        <span className="whitespace-nowrap">{email.slice(0, at)}</span>
        <wbr />
        <span className="whitespace-nowrap">{email.slice(at)}</span>
      </>
    );
  };
}

async function CodeForm({
  locale,
  searchParams,
}: Pick<OTPPageProps, "searchParams"> & { locale: SupportedLocale }) {
  const { email, redirectTo } = await readCodeRequest(searchParams);
  const loginHref = getLoginHref({ locale, redirectTo });

  if (!email) {
    redirect(loginHref);
  }

  return <OTPForm email={email} loginHref={loginHref} redirectTo={redirectTo} />;
}

export default async function OTPPage({ searchParams }: OTPPageProps) {
  const [t, locale] = await Promise.all([getExtracted(), getAuthPageLocale()]);
  const appUrl = searchParams.then((params) => getReturnAppUrl(readRedirectTo(params.redirectTo)));

  return (
    <AuthFrame appUrl={appUrl}>
      <OTP>
        <AuthHeader>
          <AuthTitle>{t("Check your email")}</AuthTitle>

          <Suspense fallback={<OTPDescriptionSkeleton />}>
            <CodeSentTo searchParams={searchParams} />
          </Suspense>
        </AuthHeader>

        <Suspense fallback={<OTPFormSkeleton />}>
          <CodeForm locale={locale} searchParams={searchParams} />
        </Suspense>
      </OTP>
    </AuthFrame>
  );
}
