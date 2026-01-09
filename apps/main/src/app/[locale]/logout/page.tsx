"use client";

import { authClient } from "@zoonk/core/auth/client";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { useLocale } from "next-intl";
import { useEffect, useEffectEvent } from "react";

export default function LogoutPage() {
  const locale = useLocale();

  const handleSuccess = useEffectEvent(() => {
    // Use hard navigation to ensure all client-side state (including useSession) is reset
    window.location.href = `/${locale}`;
  });

  useEffect(() => {
    authClient.signOut({ fetchOptions: { onSuccess: handleSuccess } });
  }, []);

  return <FullPageLoading />;
}
