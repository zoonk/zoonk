import { getSession } from "@zoonk/core/users";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { buildAuthLoginUrl } from "@zoonk/utils/auth-url";
import { cacheTagLogin } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { getExtracted, getLocale } from "next-intl/server";
import { Suspense } from "react";
import { redirect } from "@/i18n/navigation";
import { LoginRedirect } from "./login-redirect";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagLogin());

  const t = await getExtracted({ locale });

  return {
    description: t(
      "Login to your account or create a new one to start using Zoonk.",
    ),
    title: t("Login or Sign Up"),
  };
}

async function LoginHandler() {
  const session = await getSession();
  const locale = await getLocale();

  if (session) {
    redirect({ href: "/", locale });
  }

  const headersList = await headers();
  const host = headersList.get("host") || "zoonk.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const callbackUrl = `${protocol}://${host}/${locale}/auth/callback`;

  const authUrl = buildAuthLoginUrl({ callbackUrl, locale });

  return <LoginRedirect url={authUrl} />;
}

export default function Login() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <LoginHandler />
    </Suspense>
  );
}
