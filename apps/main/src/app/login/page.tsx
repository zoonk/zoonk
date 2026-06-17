import { OneTimeTokenLoginRedirect } from "@zoonk/core/auth/ott/login";
import { FullPageLoading } from "@zoonk/ui/components/loading";

type Props = PageProps<"/login">;

/**
 * Accepts only app-relative return paths for login callbacks. The central auth
 * app already validates trusted origins, but the local login page should still
 * avoid forwarding absolute or protocol-relative URLs as post-login targets.
 */
function getSafeNextPath(next: string | string[] | undefined): string | null {
  if (typeof next !== "string") {
    return null;
  }

  if (!next.startsWith("/") || next.startsWith("//")) {
    return null;
  }

  return next;
}

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

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const callbackPath = getCallbackPath(getSafeNextPath(next));

  return (
    <>
      <OneTimeTokenLoginRedirect callbackPath={callbackPath} />
      <FullPageLoading />
    </>
  );
}
