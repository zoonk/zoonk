import { buildAuthLoginUrl, getBaseUrl } from "@zoonk/utils/url";
import { redirect } from "next/navigation";

export default async function LoginPage({
  params,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  const callbackUrl = `${getBaseUrl()}/${locale}/auth/callback`;
  const authUrl = buildAuthLoginUrl({ callbackUrl, locale });
  redirect(authUrl as never);
}
