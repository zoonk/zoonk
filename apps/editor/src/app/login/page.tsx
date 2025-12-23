import { buildAuthLoginUrl, getBaseUrl } from "@zoonk/utils/url";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const callbackUrl = `${getBaseUrl()}/auth/callback`;
  const authUrl = buildAuthLoginUrl({ callbackUrl });
  redirect(authUrl as never);
}
