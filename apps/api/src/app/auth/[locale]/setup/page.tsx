import { AuthHeader, AuthTitle } from "@/components/auth-form";
import { AuthFrame } from "@/components/auth-frame";
import { Setup, SetupFormSkeleton } from "@/components/setup";
import { getAuthPageLocale } from "@/i18n/page-locale";
import { getSession } from "@zoonk/core/users/session";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCallbackHref, getLoginHref, readRedirectTo } from "../../_utils/auth-redirect";
import { getReturnAppUrl } from "../../_utils/return-app";
import { SetupProfileForm } from "./setup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Create your profile") };
}

async function SetupProfile({
  locale,
  redirectTo,
}: {
  locale: SupportedLocale;
  redirectTo: Promise<string | null>;
}) {
  const [returnTo, session] = await Promise.all([redirectTo, getSession()]);

  if (!session) {
    redirect(getLoginHref({ locale, redirectTo: returnTo }));
  }

  if (session.user.name && session.user.username) {
    redirect(getCallbackHref(returnTo));
  }

  return <SetupProfileForm defaultName={session.user.name} redirectTo={returnTo} />;
}

export default async function SetupPage({ searchParams }: PageProps<"/auth/[locale]/setup">) {
  const [t, locale] = await Promise.all([getExtracted(), getAuthPageLocale()]);
  const redirectTo = searchParams.then((params) => readRedirectTo(params.redirectTo));

  return (
    <AuthFrame appUrl={redirectTo.then(getReturnAppUrl)}>
      <Setup>
        <AuthHeader>
          <AuthTitle>{t("What should we call you?")}</AuthTitle>
        </AuthHeader>

        <Suspense fallback={<SetupFormSkeleton />}>
          <SetupProfile locale={locale} redirectTo={redirectTo} />
        </Suspense>
      </Setup>
    </AuthFrame>
  );
}
