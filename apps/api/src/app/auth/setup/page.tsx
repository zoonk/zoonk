import { AuthFrame } from "@/components/auth-frame";
import { Setup, SetupDescription, SetupHeader, SetupTitle } from "@/components/setup";
import { suggestCurrentUsername } from "@zoonk/core/users/current";
import { getSession } from "@zoonk/core/users/session";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCallbackHref, getLoginHref, readRedirectTo } from "../_utils/auth-redirect";
import { SetupProfileForm } from "./setup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Create your profile") };
}

async function SetupView({ searchParams }: PageProps<"/auth/setup">) {
  const params = await searchParams;
  const redirectTo = readRedirectTo(params.redirectTo);
  const session = await getSession();

  if (!session) {
    redirect(getLoginHref(redirectTo));
  }

  if (session.user.name && session.user.username) {
    redirect(getCallbackHref(redirectTo));
  }

  // The suggested username tries random suffixes when the plain one is taken: render per request.
  await connection();
  const [t, suggestedUsername] = await Promise.all([getExtracted(), suggestCurrentUsername()]);

  return (
    <AuthFrame>
      <Setup>
        <SetupHeader>
          <SetupTitle>{t("Create your profile")}</SetupTitle>
          <SetupDescription>
            {t("Your name and a username. You can change both later in your profile.")}
          </SetupDescription>
        </SetupHeader>

        <SetupProfileForm
          defaultName={session.user.name}
          defaultUsername={suggestedUsername ?? ""}
          redirectTo={redirectTo}
        />
      </Setup>
    </AuthFrame>
  );
}

export default async function SetupPage(props: PageProps<"/auth/setup">) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <SetupView {...props} />
    </Suspense>
  );
}
