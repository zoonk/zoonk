import { getSession } from "@zoonk/core/users";
import { buildAuthLoginUrl } from "@zoonk/utils/auth-url";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { LoginRedirect } from "./login-redirect";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect({ href: "/", locale: await getLocale() });
  }

  const locale = await getLocale();
  const headersList = await headers();
  const host = headersList.get("host") || "editor.zoonk.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const callbackUrl = `${protocol}://${host}/${locale}/auth/callback`;

  const authUrl = buildAuthLoginUrl({ callbackUrl, locale });

  return <LoginRedirect url={authUrl} />;
}
