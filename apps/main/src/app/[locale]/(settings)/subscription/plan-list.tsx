"use client";

import { authClient } from "@zoonk/core/auth/client";
import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@zoonk/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@zoonk/ui/components/radio-group";
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
  cancelMessage,
  currentPlan,
  descriptions,
  plans,
  titles,
}: {
  cancelMessage: string | null;
  currentPlan: string | null;
  descriptions: Record<string, string>;
  plans: PlanData[];
  titles: Record<string, string>;
}) {
  const currentPlanName = currentPlan ?? "free";
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [selectedPlan, setSelectedPlan] = useState(currentPlanName);
  const [state, setState] = useState<"error" | "idle" | "loading">("idle");
  const t = useExtracted();

  const freePlan: PlanData = {
    annualLookupKey: null,
    lookupKey: null,
    monthlyPrice: null,
    name: "free",
    tier: 0,
    yearlyPrice: null,
  };
  const selected = plans.find((plan) => plan.name === selectedPlan) ?? freePlan;
  const cta = getCTAAction(selected, currentPlanName);
  const isLoading = state === "loading";
  const selectedTitle = titles[selected.name] ?? selected.name;

  const ctaLabel = {
    cancel: t("Cancel"),
    downgrade: t("Switch to {plan}", { plan: selectedTitle }),
    manage: t("Manage"),
    upgrade: t("Upgrade to {plan}", { plan: selectedTitle }),
  }[cta.action];

  const handleAction = async () => {
    setState("loading");

    const isCurrent = selectedPlan === currentPlanName;
    const selectedTier = getPlanTier(selectedPlan);
    const currentTier = getPlanTier(currentPlanName);

    if (isCurrent || selectedTier < currentTier) {
      const action =
        selectedPlan === "free"
          ? authClient.subscription.cancel({ returnUrl: "/subscription" })
          : authClient.subscription.billingPortal({ returnUrl: "/subscription" });

      const { error } = await action;

      if (error) {
        setState("error");
      }

      return;
    }

    const { error } = await authClient.subscription.upgrade({
      annual: period === "yearly",
      cancelUrl: "/subscription",
      plan: selectedPlan,
      successUrl: "/subscription",
    });

    if (error) {
      setState("error");
    }
  };

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      {cancelMessage && <p className="text-destructive text-sm">{cancelMessage}</p>}

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

      <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
        {plans.map((plan) => (
          <PlanRow
            currentPlanName={currentPlanName}
            description={descriptions[plan.name] ?? ""}
            key={plan.name}
            period={period}
            plan={plan}
            title={titles[plan.name] ?? plan.name}
          />
        ))}
      </RadioGroup>

      <Button
        className="sm:self-end"
        disabled={isLoading}
        onClick={handleAction}
        variant={cta.variant}
      >
        {isLoading && <Loader2Icon className="animate-spin" />}
        {ctaLabel}
      </Button>

      {state === "error" && (
        <p className="text-destructive text-sm">
          {t("Unable to update your subscription. Contact us at hello@zoonk.com")}
        </p>
      )}
    </div>
  );
}

function PlanRow({
  currentPlanName,
  description,
  period,
  plan,
  title,
}: {
  currentPlanName: string;
  description: string;
  period: BillingPeriod;
  plan: PlanData;
  title: string;
}) {
  const t = useExtracted();
  const price = period === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const priceLabel = getPriceLabel(plan.name, price);
  const periodSuffix = period === "yearly" ? t("/yr") : t("/mo");
  const displayPrice = plan.name === "free" ? t("Free") : `${priceLabel}${periodSuffix}`;
  const isCurrent = currentPlanName === plan.name;

  return (
    <FieldLabel htmlFor={`plan-${plan.name}`}>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>
            {title}

            {isCurrent && (
              <Badge aria-label={t("Current plan")} variant="outline">
                {t("Current")}
              </Badge>
            )}
          </FieldTitle>

          <FieldDescription>{description}</FieldDescription>
        </FieldContent>

        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">{displayPrice}</span>
          <RadioGroupItem aria-label={title} id={`plan-${plan.name}`} value={plan.name} />
        </div>
      </Field>
    </FieldLabel>
  );
}

function getPriceLabel(planName: string, price: PriceInfo | null): string {
  if (planName === "free") {
    return "";
  }
  if (!price) {
    return "";
  }
  return formatPrice(price.amount, price.currency);
}

function getCTAAction(
  selected: PlanData,
  currentPlanName: string,
): {
  action: "cancel" | "downgrade" | "manage" | "upgrade";
  variant: "default" | "destructive" | "outline";
} {
  const currentTier = getPlanTier(currentPlanName);

  if (selected.name === currentPlanName) {
    return { action: "manage", variant: "outline" };
  }

  if (selected.tier > currentTier) {
    return { action: "upgrade", variant: "default" };
  }

  if (selected.name === "free") {
    return { action: "cancel", variant: "destructive" };
  }

  return { action: "downgrade", variant: "destructive" };
}
