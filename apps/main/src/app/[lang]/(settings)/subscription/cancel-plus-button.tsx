"use client";

import { authClient } from "@zoonk/auth/client";
import { Button } from "@zoonk/ui/components/button";
import { logError } from "@zoonk/utils/logger";
import { Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";

/**
 * Opens Stripe's cancellation page, where the subscriber confirms it. Plus stays until the end of
 * the period they paid for.
 */
export function CancelPlusButton() {
  const t = useExtracted();
  const [state, setState] = useState<"error" | "idle" | "loading">("idle");
  const isLoading = state === "loading";

  const cancel = async () => {
    setState("loading");

    const { error } = await authClient.subscription.cancel({ returnUrl: "/subscription" });

    if (error) {
      setState("error");
      logError("Subscription cancellation failed", { error });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        aria-busy={isLoading}
        className="w-max"
        disabled={isLoading}
        onClick={cancel}
        type="button"
        variant="outline"
      >
        {isLoading && <Loader2Icon aria-hidden="true" className="animate-spin" />}
        {t("Cancel subscription")}
      </Button>

      {state === "error" && (
        <p className="text-destructive text-sm" role="alert">
          {t("Unable to manage your subscription. Contact us at hello@zoonk.com")}
        </p>
      )}
    </div>
  );
}
