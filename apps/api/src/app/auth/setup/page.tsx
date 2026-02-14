import { Setup, SetupDescription, SetupHeader, SetupTitle } from "@/components/setup";
import { getSession } from "@zoonk/core/users/session/get";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { getExtracted } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SetupProfileForm } from "./setup-form";

async function SetupView({ searchParams }: PageProps<"/auth/setup">) {
  const { redirectTo } = await searchParams;
  const session = await getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const hasName = Boolean(session.user.name);
  const hasUsername = Boolean(session.user.username);

  if (hasName && hasUsername) {
    redirect(`/auth/callback?redirectTo=${encodeURIComponent(String(redirectTo))}`);
  }

  const t = await getExtracted();

  return (
    <>
      <SetupHeader>
        <SetupTitle>{t("Complete your profile")}</SetupTitle>
        <SetupDescription>{t("Choose a name and username before continuing.")}</SetupDescription>
      </SetupHeader>

      <SetupProfileForm defaultName={session.user.name} redirectTo={String(redirectTo)} />
    </>
  );
}

export default async function SetupPage(props: PageProps<"/auth/setup">) {
  return (
    <Setup>
      <Suspense fallback={<FullPageLoading />}>
        <SetupView {...props} />
      </Suspense>
    </Setup>
  );
}
