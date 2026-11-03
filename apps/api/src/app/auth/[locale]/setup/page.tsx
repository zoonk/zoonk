import { AuthFrame } from "@/components/auth-frame";
import {
  Setup,
  SetupDescription,
  SetupFormSkeleton,
  SetupHeader,
  SetupTitle,
} from "@/components/setup";
import { getAuthPageLocale } from "@/i18n/page-locale";
import { suggestCurrentUsername } from "@zoonk/core/users/current";
import { getSession } from "@zoonk/core/users/session";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
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

  // The suggested username tries random suffixes when the plain one is taken: render per request.
  await connection();
  const suggestedUsername = await suggestCurrentUsername();

  return (
    <SetupProfileForm
      defaultName={session.user.name}
      defaultUsername={suggestedUsername ?? ""}
      redirectTo={returnTo}
    />
  );
}

export default async function SetupPage({ searchParams }: PageProps<"/auth/[locale]/setup">) {
  const [t, locale] = await Promise.all([getExtracted(), getAuthPageLocale()]);
  const redirectTo = searchParams.then((params) => readRedirectTo(params.redirectTo));

  return (
    <AuthFrame appUrl={redirectTo.then(getReturnAppUrl)}>
      <Setup>
        <SetupHeader>
          <SetupTitle>{t("What should we call you?")}</SetupTitle>
          <SetupDescription>
            {t({
              description: "“it” is the name and username the learner picks on this screen.",
              message: "You can change it later in your profile.",
            })}
          </SetupDescription>
        </SetupHeader>

        <Suspense fallback={<SetupFormSkeleton />}>
          <SetupProfile locale={locale} redirectTo={redirectTo} />
        </Suspense>
      </Setup>
    </AuthFrame>
  );
}
