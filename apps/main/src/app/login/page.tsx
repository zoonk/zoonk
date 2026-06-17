import { OneTimeTokenLoginRedirect } from "@zoonk/core/auth/ott/login";
import { getSafeAppRelativePath } from "@zoonk/core/auth/ott/redirect";
import { FullPageLoading } from "@zoonk/ui/components/loading";

type Props = PageProps<"/login">;

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
  const callbackPath = getCallbackPath(getSafeAppRelativePath(next));

  return (
    <>
      <OneTimeTokenLoginRedirect callbackPath={callbackPath} />
      <FullPageLoading />
    </>
  );
}
