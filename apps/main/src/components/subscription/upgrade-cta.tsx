"use client";

import { authClient } from "@zoonk/core/auth/client";
import { Button } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";

export function UpgradeCTA({ returnUrl }: { returnUrl: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const t = useExtracted();
  const isLoading = state === "loading";

  const subscribe = async () => {
    setState("loading");

    const { error } = await authClient.subscription.upgrade({
      cancelUrl: returnUrl,
      plan: "hobby",
      successUrl: returnUrl,
    });

    if (error) {
      console.error("Error upgrading subscription:", error);
      setState("error");
    }
  };

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>

        <EmptyTitle>{t("Upgrade to generate")}</EmptyTitle>

        <EmptyDescription>
          {t("Generating content with AI requires an active subscription.")}
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Button disabled={isLoading} onClick={subscribe}>
          {isLoading && <Loader2Icon className="animate-spin" />}
          {t("Upgrade")}
        </Button>

        {state === "error" && (
          <p className="text-destructive text-sm">
            {t(
              "Unable to update your subscription. Contact us at hello@zoonk.com",
            )}
          </p>
        )}
      </EmptyContent>
    </Empty>
  );
}
