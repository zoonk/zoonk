import { externalRedirect } from "@zoonk/next/navigation/external-redirect";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { buildAuthLoginUrl, getBaseUrl } from "@zoonk/utils/origin";
import { connection } from "next/server";
import { Suspense } from "react";

async function LoginPageContent(): Promise<React.ReactNode> {
  await connection();
  const callbackUrl = `${getBaseUrl()}/auth/callback`;
  const authUrl = buildAuthLoginUrl({ callbackUrl });
  return externalRedirect(authUrl);
}

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <LoginPageContent />
    </Suspense>
  );
}
