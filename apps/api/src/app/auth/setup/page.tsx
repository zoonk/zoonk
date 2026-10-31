import { AuthFrame } from "@/components/auth-frame";
import { Setup, SetupDescription, SetupHeader, SetupTitle } from "@/components/setup";
import { suggestCurrentUsername } from "@zoonk/core/users/current";
import { getSession } from "@zoonk/core/users/session";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCallbackHref, getLoginHref, readRedirectTo } from "../_utils/auth-redirect";
import { getReturnAppUrl } from "../_utils/return-app";
import { SetupProfileForm } from "./setup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Create your profile") };
}

export default async function SetupPage({ searchParams }: PageProps<"/auth/setup">) {
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
  const suggestedUsername = await suggestCurrentUsername();
  const t = await getExtracted();

  return (
    <AuthFrame appUrl={getReturnAppUrl(redirectTo)}>
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

        <SetupProfileForm
          defaultName={session.user.name}
          defaultUsername={suggestedUsername ?? ""}
          redirectTo={redirectTo}
        />
      </Setup>
    </AuthFrame>
  );
}
