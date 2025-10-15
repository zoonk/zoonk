"use client";

import { useSubscription } from "@zoonk/auth/hooks/subscription";
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
import { useTranslations } from "next-intl";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function SubscriptionPage() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const { subscription, isPending } = useSubscription();
  const t = useTranslations("Subscription");
  const isLoading = state === "loading";
  const hasError = state === "error";

  const title = subscription ? t("plus.title") : t("free.title");
  const action = subscription ? t("plus.action") : t("free.action");
  const description = subscription
    ? t("plus.description")
    : t("free.description");

  const subscribe = async () => {
    setState("loading");

    try {
      const { error } = await authClient.subscription.upgrade({
        plan: "plus",
        successUrl: "/subscription",
        cancelUrl: "/subscription",
      });

      if (error) {
        setState("error");
        return;
      }
    } catch {
      setState("error");
    }
  };

  const manageSubscription = async () => {
    setState("loading");

    try {
      const { error } = await authClient.subscription.billingPortal({
        returnUrl: "/subscription",
      });

      if (error) {
        setState("error");
        return;
      }
    } catch {
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
        <Button variant="outline" disabled={isLoading} onClick={handleAction}>
          {isLoading && <Loader2Icon className="animate-spin" />}
          {action}
        </Button>
      </ItemActions>

      {hasError && (
        <ItemFooter className="text-destructive">{t("error")}</ItemFooter>
      )}
    </Item>
  );
}
