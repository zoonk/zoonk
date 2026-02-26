import { externalRedirect } from "@zoonk/next/navigation/external-redirect";
import { buildAuthLoginUrl, getBaseUrl } from "@zoonk/utils/url";

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  const callbackUrl = `${getBaseUrl()}/${locale}/auth/callback`;
  const authUrl = buildAuthLoginUrl({ callbackUrl });
  externalRedirect(authUrl);
}
