import { externalRedirect } from "@zoonk/next/navigation/external-redirect";
import { buildAuthLoginUrl, getBaseUrl } from "@zoonk/utils/url";

export default async function LoginPage() {
  const callbackUrl = `${getBaseUrl()}/auth/callback`;
  const authUrl = buildAuthLoginUrl({ callbackUrl });
  externalRedirect(authUrl);
}
