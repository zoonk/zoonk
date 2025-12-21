import { getSession } from "@zoonk/core/users";
import { buildAuthLoginUrl } from "@zoonk/utils/auth-url";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { RedirectType } from "next/navigation";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect("/");
  }

  const headersList = await headers();
  const host = headersList.get("host") || "admin.zoonk.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const callbackUrl = `${protocol}://${host}/auth/callback`;

  const authUrl = buildAuthLoginUrl({ callbackUrl });

  // Using type assertion for external URL redirect
  redirect(authUrl as Parameters<typeof redirect>[0]);
}
