"use client";

import { authClient } from "@zoonk/auth/client";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Suspense, useEffect, useEffectEvent } from "react";
import { redirect } from "@/i18n/navigation";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const token = searchParams.get("token");

  const handleVerify = useEffectEvent(async (userToken: string) => {
    // we're using a client component to properly set session cookies after token verification
    // on server-side, the session cookies aren't set
    const { error } = await authClient.oneTimeToken.verify({
      token: userToken,
    });

    if (error) {
      console.error("Failed to verify one-time token:", error);
      return redirect({ href: "/login", locale });
    }

    redirect({ href: "/", locale });
  });

  useEffect(() => {
    if (token) {
      void handleVerify(token);
    }
  }, [token]);

  return <FullPageLoading />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <CallbackHandler />
    </Suspense>
  );
}
