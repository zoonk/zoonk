import { getSession } from "@zoonk/core/users";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { buildAuthLoginUrl } from "@zoonk/utils/auth-url";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginRedirect } from "./login-redirect";

const APP_URL =
  process.env.NEXT_PUBLIC_ADMIN_APP_URL || "https://admin.zoonk.com";

async function LoginHandler() {
  const session = await getSession();

  if (session) {
    redirect("/");
  }

  const callbackUrl = `${APP_URL}/auth/callback`;
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
