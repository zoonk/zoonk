import { getSession } from "@zoonk/core/users";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { sanitizeRedirectUrl } from "@zoonk/utils/auth-url";
import { redirect } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { createOneTimeTokenAction } from "./actions";
import { CallbackRedirect } from "./callback-redirect";

async function CallbackHandler({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/callback">["searchParams"];
}) {
  const session = await getSession();
  const { redirectTo } = await searchParams;

  // Validate and sanitize the redirectTo parameter
  const safeRedirectTo = sanitizeRedirectUrl(
    redirectTo ? String(redirectTo) : undefined,
  );

  if (!session) {
    // Not logged in, redirect to login
    const loginUrl = safeRedirectTo
      ? `/login?redirectTo=${encodeURIComponent(safeRedirectTo)}`
      : "/login";
    redirect(loginUrl);
  }

  if (!safeRedirectTo) {
    // No valid redirect URL, show a success message
    const t = await getExtracted();

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="font-bold text-xl">{t("You're signed in!")}</h1>
        <p className="text-muted-foreground">
          {t("You can close this window and return to your app.")}
        </p>
      </div>
    );
  }

  // Generate OTT and get the redirect URL
  const externalUrl = await createOneTimeTokenAction(safeRedirectTo);

  // Use client-side redirect for external URL
  return <CallbackRedirect url={externalUrl} />;
}

export default async function CallbackPage(
  props: PageProps<"/[locale]/callback">,
) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <CallbackHandler searchParams={props.searchParams} />
    </Suspense>
  );
}
