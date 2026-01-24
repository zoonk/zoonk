"use client";

import { authClient } from "@zoonk/core/auth/client";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { useEffect, useEffectEvent } from "react";

export default function LogoutPage() {
  const handleSuccess = useEffectEvent(() => {
    // Use hard navigation to ensure all client-side state (including useSession) is reset
    globalThis.location.href = "/";
  });

  useEffect(() => {
    void authClient.signOut({ fetchOptions: { onSuccess: handleSuccess } });
  }, []);

  return <FullPageLoading />;
}
