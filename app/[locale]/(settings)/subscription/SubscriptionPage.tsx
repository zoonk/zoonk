"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { useSubscription } from "@/hooks/useSubscription";
import { authClient } from "@/lib/auth-client";

export function SubscriptionPage() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const { subscription } = useSubscription();
  const t = useTranslations("Subscription");
  const isLoading = state === "loading";

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
    </Item>
  );
}
