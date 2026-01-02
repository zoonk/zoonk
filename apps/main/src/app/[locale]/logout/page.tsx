"use client";

import { authClient } from "@zoonk/core/auth/client";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { useEffect, useEffectEvent } from "react";
import { useRouter } from "@/i18n/navigation";

export default function LogoutPage() {
  const { push } = useRouter();

  const handleSuccess = useEffectEvent(() => {
    push("/");
  });

  useEffect(() => {
    authClient.signOut({ fetchOptions: { onSuccess: handleSuccess } });
  }, []);

  return <FullPageLoading />;
}
