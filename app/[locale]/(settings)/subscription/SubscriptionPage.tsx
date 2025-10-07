"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { useSubscription } from "@/hooks/useSubscription";

export function SubscriptionPage() {
  const { subscription } = useSubscription();
  const t = useTranslations("Subscription");

  const title = subscription ? t("plus.title") : t("free.title");
  const action = subscription ? t("plus.action") : t("free.action");
  const description = subscription
    ? t("plus.description")
    : t("free.description");

  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>

      <ItemActions>
        <Button variant="outline">{action}</Button>
      </ItemActions>
    </Item>
  );
}
