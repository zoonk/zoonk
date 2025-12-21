import { getSession } from "@zoonk/core/users";
import { buildAuthLoginUrl } from "@zoonk/utils/auth-url";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect("/" as Parameters<typeof redirect>[0]);
  }

  const locale = await getLocale();
  const headersList = await headers();
  const host = headersList.get("host") || "editor.zoonk.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const callbackUrl = `${protocol}://${host}/${locale}/auth/callback`;

  const authUrl = buildAuthLoginUrl({ callbackUrl, locale });

  redirect(authUrl as Parameters<typeof redirect>[0]);
}
