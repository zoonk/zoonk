"use client";

import { authClient } from "@zoonk/auth/client";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent } from "react";

export default function LogoutPage() {
  const { push } = useRouter();

  const handleSuccess = useEffectEvent(() => {
    push("/login");
  });

  useEffect(() => {
    authClient.signOut({ fetchOptions: { onSuccess: handleSuccess } });
  }, []);

  return <FullPageLoading />;
}
