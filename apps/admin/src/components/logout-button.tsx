"use client";

import { authClient } from "@zoonk/auth/client";
import { Button } from "@zoonk/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LogoutState = "idle" | "loading" | "error";

export function LogoutButton() {
  const [state, setState] = useState<LogoutState>("idle");
  const { push } = useRouter();

  const handleError = () => {
    setState("error");
  };

  const handleSuccess = () => {
    setState("idle");
    push("/login");
  };

  const handleLogout = async () => {
    setState("loading");

    await authClient.signOut({
      fetchOptions: {
        onError: handleError,
        onSuccess: handleSuccess,
      },
    });
  };

  return (
    <Button disabled={state === "loading"} onClick={handleLogout}>
      Logout
    </Button>
  );
}
