"use client";

import { AdminGateScreen } from "@/components/admin-gate-screen";
import { OneTimeTokenLoginRedirect } from "@zoonk/core/auth/ott/login";
import { EnterButton } from "@zoonk/ui/components/enter-button";
import { DEFAULT_LOCALE } from "@zoonk/utils/locale";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Admin has no login form of its own: it sends staff to Zoonk's and takes them back. After a
 * login that didn't work the page waits for a press, so a failing login can't loop.
 */
export function LoginScreen() {
  const failed = useSearchParams().get("error") === "auth";
  const [started, setStarted] = useState(!failed);

  return (
    <AdminGateScreen
      action={
        started ? (
          <OneTimeTokenLoginRedirect callbackPath="/auth/callback" locale={DEFAULT_LOCALE} />
        ) : (
          <EnterButton onClick={() => setStarted(true)} size="lg">
            Try again
          </EnterButton>
        )
      }
      title="Zoonk Admin"
    >
      {started ? "Taking you to log in…" : "That login didn't work."}
    </AdminGateScreen>
  );
}
