"use client";

import { OneTimeTokenLoginRedirect } from "@zoonk/core/auth/ott/login";
import { Button } from "@zoonk/ui/components/button";
import { ZoonkLogo } from "@zoonk/ui/components/zoonk-logo";
import { DEFAULT_LOCALE } from "@zoonk/utils/locale";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Admin has no sign-in form of its own: it sends staff to Zoonk's and takes them back. After a
 * sign-in that didn't work the page waits for a press, so a failing sign-in can't loop.
 */
export function LoginScreen() {
  const failed = useSearchParams().get("error") === "auth";
  const [started, setStarted] = useState(!failed);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <ZoonkLogo className="size-10" />

      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Zoonk Admin</h1>
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {started ? "Taking you to sign in…" : "That sign-in didn't work."}
        </p>
      </div>

      {started ? (
        <OneTimeTokenLoginRedirect callbackPath="/auth/callback" locale={DEFAULT_LOCALE} />
      ) : (
        <Button onClick={() => setStarted(true)} size="lg">
          Try again
        </Button>
      )}
    </main>
  );
}
