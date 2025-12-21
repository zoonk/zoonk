import { auth } from "@zoonk/auth";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import { redirect } from "@/i18n/navigation";

async function CallbackHandler({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/auth/callback">["searchParams"];
}) {
  const { token } = await searchParams;
  const locale = await getLocale();

  if (!token) {
    return redirect({ href: "/login", locale });
  }

  try {
    await auth.api.verifyOneTimeToken({
      body: { token: String(token) },
    });
  } catch (error) {
    console.error("Failed to verify one-time token:", error);
    return redirect({ href: "/login", locale });
  }

  // Successfully verified, redirect to home
  return redirect({ href: "/", locale });
}

export default function AuthCallbackPage(
  props: PageProps<"/[locale]/auth/callback">,
) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <CallbackHandler searchParams={props.searchParams} />
    </Suspense>
  );
}
