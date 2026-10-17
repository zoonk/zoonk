"use client";

import { Button } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";

/**
 * Opens Stripe's cancellation page, where the subscriber confirms it. Plus stays until the end of
 * the period they paid for. The auth client loads on the tap, so the page doesn't ship it up front.
 */
export function CancelPlusButton() {
  const t = useExtracted();
  const [state, setState] = useState<"error" | "idle" | "loading">("idle");
  const isLoading = state === "loading";

  const cancel = async () => {
    setState("loading");

    const { data: refusal, error } = await safeAsync(async () => {
      const { authClient } = await import("@zoonk/auth/client");
      const result = await authClient.subscription.cancel({ returnUrl: "/subscription" });
      return result.error;
    });

    const failure = error ?? refusal;

    if (failure) {
      setState("error");
      logError("Subscription cancellation failed", { error: failure });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        aria-busy={isLoading}
        className="w-max"
        disabled={isLoading}
        onClick={cancel}
        size="sm"
        type="button"
        variant="outline"
      >
        {isLoading && <Loader2Icon aria-hidden="true" className="animate-spin" />}
        {t("Cancel subscription")}
      </Button>

      {state === "error" && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("Unable to manage your subscription. Contact us at hello@zoonk.com")}
        </p>
      )}
    </div>
  );
}
