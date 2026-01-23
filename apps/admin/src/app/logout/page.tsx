"use client";

import { authClient } from "@zoonk/core/auth/client";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent } from "react";

export default function LogoutPage() {
  const router = useRouter();

  const handleSuccess = useEffectEvent(() => {
    router.push("/login");
  });

  useEffect(() => {
    void authClient.signOut({ fetchOptions: { onSuccess: handleSuccess } });
  }, []);

  return <FullPageLoading />;
}
