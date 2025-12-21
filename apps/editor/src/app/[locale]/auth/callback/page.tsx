import { auth } from "@zoonk/auth";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export default async function AuthCallbackPage({
  searchParams,
}: PageProps<"/[locale]/auth/callback">) {
  const { token } = await searchParams;
  const locale = await getLocale();

  if (!token) {
    redirect({ href: "/login", locale });
  }

  try {
    await auth.api.verifyOneTimeToken({
      body: { token: String(token) },
    });
  } catch (error) {
    console.error("Failed to verify one-time token:", error);
    redirect({ href: "/login", locale });
  }

  // Successfully verified, redirect to home
  redirect({ href: "/", locale });
}
