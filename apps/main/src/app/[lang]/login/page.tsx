import { OneTimeTokenLoginRedirect } from "@zoonk/core/auth/ott/login";
import { getSafeAppRelativePath } from "@zoonk/core/auth/ott/redirect";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { Suspense } from "react";

type Props = PageProps<"/[lang]/login">;

export const prefetch = "force-disabled";

/**
 * Builds the callback path sent to central auth. Keeping the return target on
 * the app callback lets the token handoff finish locally before redirecting
 * the learner back to the lesson that started the login flow.
 */
function getCallbackPath(nextPath: string | null) {
  if (!nextPath) {
    return "/auth/callback";
  }

  return `/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

/**
 * Resolves the return target inside Suspense so the page can prerender its
 * loading shell without reading request-specific query parameters.
 */
async function LoginRedirect({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ lang }, { next }] = await Promise.all([params, searchParams]);
  const callbackPath = getCallbackPath(getSafeAppRelativePath(next));
  const locale = getSupportedLocaleFromLanguage(lang);

  return (
    <>
      <OneTimeTokenLoginRedirect callbackPath={callbackPath} locale={locale} />
      <FullPageLoading />
    </>
  );
}

export default function LoginPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <LoginRedirect params={params} searchParams={searchParams} />
    </Suspense>
  );
}
