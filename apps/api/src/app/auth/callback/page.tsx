import { getSession } from "@zoonk/core/users/session/get";
import { externalRedirect } from "@zoonk/next/navigation/external-redirect";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createOneTimeTokenAction, validateTrustedOriginAction } from "./actions";

async function CallbackHandler({
  searchParams,
}: {
  searchParams: PageProps<"/auth/callback">["searchParams"];
}) {
  const { redirectTo } = await searchParams;
  const redirectToStr = String(redirectTo);

  const isTrusted = await validateTrustedOriginAction(redirectToStr);

  if (!isTrusted) {
    return redirect("/auth/untrusted-origin");
  }

  const session = await getSession();
  const needsSetup = !session?.user.username || !session?.user.name;

  if (session && needsSetup) {
    redirect(`/auth/setup?redirectTo=${encodeURIComponent(redirectToStr)}`);
  }

  const result = await createOneTimeTokenAction(redirectToStr);

  if (!result.success) {
    return redirect("/auth/untrusted-origin");
  }

  return externalRedirect(result.url);
}

export default async function CallbackPage(props: PageProps<"/auth/callback">) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <CallbackHandler searchParams={props.searchParams} />
    </Suspense>
  );
}
