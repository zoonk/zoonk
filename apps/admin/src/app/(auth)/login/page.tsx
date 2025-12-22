import { getSession } from "@zoonk/core/users";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { buildAuthLoginUrl, getBaseUrl } from "@zoonk/utils/url";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginRedirect } from "./login-redirect";

async function LoginHandler() {
  const session = await getSession();

  if (session) {
    redirect("/");
  }

  const callbackUrl = `${getBaseUrl()}/auth/callback`;
  const authUrl = buildAuthLoginUrl({ callbackUrl });

  return <LoginRedirect url={authUrl} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <LoginHandler />
    </Suspense>
  );
}
