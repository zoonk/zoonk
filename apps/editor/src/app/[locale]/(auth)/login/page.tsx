import { getSession } from "@zoonk/core/users";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { buildAuthLoginUrl } from "@zoonk/utils/auth-url";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import { redirect } from "@/i18n/navigation";
import { LoginRedirect } from "./login-redirect";

const APP_URL =
  process.env.NEXT_PUBLIC_EDITOR_APP_URL || "https://editor.zoonk.com";

async function LoginHandler() {
  const session = await getSession();
  const locale = await getLocale();

  if (session) {
    redirect({ href: "/", locale });
  }

  const callbackUrl = `${APP_URL}/${locale}/auth/callback`;
  const authUrl = buildAuthLoginUrl({ callbackUrl, locale });

  return <LoginRedirect url={authUrl} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <LoginHandler />
    </Suspense>
  );
}
