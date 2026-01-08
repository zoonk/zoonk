"use client";

import { authClient } from "@zoonk/core/auth/client";
import { useSubscription } from "@zoonk/core/auth/hooks/subscription";
import { Button } from "@zoonk/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";

export function SubscriptionPage() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const { subscription, isPending } = useSubscription();
  const t = useExtracted();
  const isLoading = state === "loading";
  const hasError = state === "error";

  const title = subscription ? t("Your subscription is active") : t("Upgrade");
  const action = subscription ? t("Manage subscription") : t("Upgrade");

  const description = subscription
    ? t("No ads, unlimited lessons, and full progress tracking.")
    : t("Remove ads, unlock unlimited lessons, and track your progress.");

  const subscribe = async () => {
    setState("loading");

    const { error } = await authClient.subscription.upgrade({
      cancelUrl: "/subscription",
      plan: "hobby",
      successUrl: "/subscription",
    });

    if (error) {
      console.error("Error upgrading subscription:", error);
      setState("error");
    }
  };

  const manageSubscription = async () => {
    setState("loading");

    const { error } = await authClient.subscription.billingPortal({
      returnUrl: "/subscription",
    });

    if (error) {
      console.error("Error accessing billing portal:", error);
      setState("error");
    }
  };

  const handleAction = () =>
    subscription ? manageSubscription() : subscribe();

  if (isPending) {
    return (
      <Item variant="outline">
        <ItemContent>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 max-w-sm" />
        </ItemContent>

        <ItemActions>
          <Skeleton className="h-8 w-24" />
        </ItemActions>
      </Item>
    );
  }

  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>

      <ItemActions>
        <Button disabled={isLoading} onClick={handleAction}>
          {isLoading && <Loader2Icon className="animate-spin" />}
          {action}
        </Button>
      </ItemActions>

      {hasError && (
        <ItemFooter className="text-destructive">
          {t(
            "Unable to update your subscription. Contact us at hello@zoonk.com",
          )}
        </ItemFooter>
      )}
    </Item>
  );
}
