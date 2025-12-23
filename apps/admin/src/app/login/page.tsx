import { FullPageLoading } from "@zoonk/ui/components/loading";
import { buildAuthLoginUrl, getBaseUrl } from "@zoonk/utils/url";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function Login() {
  const callbackUrl = `${getBaseUrl()}/auth/callback`;
  const authUrl = buildAuthLoginUrl({ callbackUrl });
  return redirect(authUrl as never);
}

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <Login />
    </Suspense>
  );
}
