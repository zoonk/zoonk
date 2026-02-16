"use client";

import { authClient } from "@zoonk/core/auth/client";
import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { Tabs, TabsList, TabsTrigger } from "@zoonk/ui/components/tabs";
import { type PriceInfo, formatPrice } from "@zoonk/utils/currency";
import { Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { getPlanTier } from "./_utils/plans";

type PlanData = {
  annualLookupKey: string | null;
  lookupKey: string | null;
  monthlyPrice: PriceInfo | null;
  name: string;
  tier: number;
  yearlyPrice: PriceInfo | null;
};

type BillingPeriod = "monthly" | "yearly";

function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === "monthly" || value === "yearly";
}

export function PlanList({
  currentPlan,
  descriptions,
  plans,
  titles,
}: {
  currentPlan: string | null;
  descriptions: Record<string, string>;
  plans: PlanData[];
  titles: Record<string, string>;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={period}
        onValueChange={(value) => {
          if (isBillingPeriod(value)) {
            setPeriod(value);
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="monthly">{t("Monthly")}</TabsTrigger>
          <TabsTrigger value="yearly">{t("Yearly")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <ItemGroup>
        {plans.map((plan) => (
          <PlanItem
            currentPlan={currentPlan}
            description={descriptions[plan.name] ?? ""}
            key={plan.name}
            period={period}
            plan={plan}
            title={titles[plan.name] ?? plan.name}
          />
        ))}
      </ItemGroup>
    </div>
  );
}

function PlanItem({
  currentPlan,
  description,
  period,
  plan,
  title,
}: {
  currentPlan: string | null;
  description: string;
  period: BillingPeriod;
  plan: PlanData;
  title: string;
}) {
  const [state, setState] = useState<"error" | "idle" | "loading">("idle");
  const t = useExtracted();

  const isCurrent = (currentPlan ?? "free") === plan.name;
  const currentTier = getPlanTier(currentPlan);
  const isAbove = plan.tier > currentTier;
  const isBelow = plan.tier < currentTier;
  const isLoading = state === "loading";
  const price = period === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

  const priceLabel = getPriceLabel(plan.name, price);
  const periodSuffix = period === "yearly" ? t("/yr") : t("/mo");
  const displayPrice = plan.name === "free" ? t("Free") : `${priceLabel}${periodSuffix}`;

  const buttonAction = getButtonAction(plan, currentTier, isCurrent, isAbove);

  const buttonLabel = {
    cancel: t("Cancel"),
    manage: t("Manage"),
    switch: t("Switch"),
    upgrade: t("Upgrade"),
  }[buttonAction.action];

  const handleAction = async () => {
    setState("loading");

    if (isCurrent || isBelow) {
      const { error } = await authClient.subscription.billingPortal({
        returnUrl: "/subscription",
      });

      if (error) {
        setState("error");
        return;
      }

      return;
    }

    const annual = period === "yearly";

    const { error } = await authClient.subscription.upgrade({
      annual,
      cancelUrl: "/subscription",
      plan: plan.name,
      successUrl: "/subscription",
    });

    if (error) {
      setState("error");
    }
  };

  return (
    <Item variant={isCurrent ? "muted" : "outline"}>
      <ItemContent>
        <ItemTitle>
          {title}

          {isCurrent && (
            <Badge aria-label={t("Current plan")} variant="outline">
              {t("Current")}
            </Badge>
          )}
        </ItemTitle>

        <ItemDescription>{description}</ItemDescription>
      </ItemContent>

      <ItemActions>
        <span className="text-muted-foreground text-sm">{displayPrice}</span>

        {plan.name !== "free" && (
          <Button disabled={isLoading} onClick={handleAction} variant={buttonAction.variant}>
            {isLoading && <Loader2Icon className="animate-spin" />}
            {buttonLabel}
          </Button>
        )}
      </ItemActions>

      {state === "error" && (
        <ItemFooter className="text-destructive text-sm">
          {t("Unable to update your subscription. Contact us at hello@zoonk.com")}
        </ItemFooter>
      )}
    </Item>
  );
}

function getPriceLabel(
  planName: string,
  price: PriceInfo | null,
): string {
  if (planName === "free") {return "";}
  if (!price) {return "";}
  return formatPrice(price.amount, price.currency);
}

function getButtonAction(
  plan: PlanData,
  currentTier: number,
  isCurrent: boolean,
  isAbove: boolean,
): {
  action: "cancel" | "manage" | "switch" | "upgrade";
  variant: "default" | "outline";
} {
  if (isCurrent) {
    return { action: "manage", variant: "outline" };
  }

  if (isAbove) {
    const isNextTier = plan.tier === currentTier + 1;
    return { action: "upgrade", variant: isNextTier ? "default" : "outline" };
  }

  if (plan.name === "free") {
    return { action: "cancel", variant: "outline" };
  }

  return { action: "switch", variant: "outline" };
}
