import { getStripePrices } from "@zoonk/core/auth/stripe-prices";
import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type PriceInfo, countryToCurrency } from "@zoonk/utils/currency";
import { safeAsync } from "@zoonk/utils/error";
import { getExtracted } from "next-intl/server";
import { headers } from "next/headers";
import { SUBSCRIPTION_PLANS } from "./_utils/plans";
import { PlanList } from "./plan-list";

export async function SubscriptionPlans() {
  const requestHeaders = await headers();
  const t = await getExtracted();

  const countryCode = requestHeaders.get("x-vercel-ip-country") ?? "US";
  const currency = countryToCurrency(countryCode);

  const lookupKeys: string[] = SUBSCRIPTION_PLANS.flatMap((plan) =>
    [plan.lookupKey, plan.annualLookupKey].filter((key) => key !== null),
  );

  const [subscription, prices] = await Promise.all([
    getActiveSubscription(requestHeaders),
    safeAsync(() => getStripePrices(lookupKeys, currency)),
  ]);

  const priceMap = prices.data ?? new Map<string, PriceInfo>();
  const currentPlan = subscription?.plan ?? null;

  const plans = SUBSCRIPTION_PLANS.map((plan) => {
    const monthlyPrice = plan.lookupKey ? (priceMap.get(plan.lookupKey) ?? null) : null;
    const yearlyPrice = plan.annualLookupKey ? (priceMap.get(plan.annualLookupKey) ?? null) : null;

    return {
      annualLookupKey: plan.annualLookupKey,
      lookupKey: plan.lookupKey,
      monthlyPrice,
      name: plan.name,
      tier: plan.tier,
      yearlyPrice,
    };
  });

  const titles: Record<string, string> = {
    free: t("Free"),
    hobby: t("Hobby"),
    plus: t("Plus"),
    pro: t("Pro"),
  };

  const descriptions: Record<string, string> = {
    free: t("Limited lessons with ads"),
    hobby: t("Unlimited lessons, no ads"),
    plus: t("Personalized lessons, fast AI"),
    pro: t("Personalized lessons, smartest AI"),
  };

  return (
    <PlanList currentPlan={currentPlan} descriptions={descriptions} plans={plans} titles={titles} />
  );
}

export function SubscriptionPlansSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-48" />

      {Array.from({ length: 4 }, (_, i) => (
        <Item key={i} variant="outline">
          <ItemContent>
            <ItemTitle>
              <Skeleton className="h-4 w-20" />
            </ItemTitle>

            <Skeleton className="h-4 w-48" />
          </ItemContent>

          <ItemActions>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-20" />
          </ItemActions>
        </Item>
      ))}
    </div>
  );
}
