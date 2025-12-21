import { getSession } from "@zoonk/core/users";
import { buildAuthLoginUrl } from "@zoonk/utils/auth-url";
import { cacheTagLogin } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getExtracted, getLocale } from "next-intl/server";

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

export default async function Login() {
  const session = await getSession();

  if (session) {
    redirect("/" as Parameters<typeof redirect>[0]);
  }

  const locale = await getLocale();
  const headersList = await headers();
  const host = headersList.get("host") || "zoonk.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const callbackUrl = `${protocol}://${host}/${locale}/auth/callback`;

  const authUrl = buildAuthLoginUrl({ callbackUrl, locale });

  redirect(authUrl as Parameters<typeof redirect>[0]);
}
