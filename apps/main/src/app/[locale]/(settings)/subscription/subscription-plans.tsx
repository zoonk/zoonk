import { getStripePrices } from "@zoonk/core/auth/stripe-prices";
import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { countryToCurrency } from "@zoonk/utils/currency";
import { getCountryFromAcceptLanguage } from "@zoonk/utils/locale";
import { SUBSCRIPTION_PLANS } from "@zoonk/utils/subscription";
import { getExtracted, getFormatter } from "next-intl/server";
import { headers } from "next/headers";
import { PlanList } from "./plan-list";

export async function SubscriptionPlans() {
  const requestHeaders = await headers();
  const t = await getExtracted();
  const format = await getFormatter();

  const countryCode =
    requestHeaders.get("x-vercel-ip-country") ??
    getCountryFromAcceptLanguage(requestHeaders.get("accept-language"));

  const currency = countryToCurrency(countryCode);

  const lookupKeys: string[] = SUBSCRIPTION_PLANS.flatMap((plan) =>
    [plan.lookupKey, plan.annualLookupKey].filter((key) => key !== null),
  );

  const [subscription, priceMap] = await Promise.all([
    getActiveSubscription(requestHeaders),
    getStripePrices(lookupKeys, currency),
  ]);
  const currentPlan = subscription?.plan ?? null;

  const cancelMessage = subscription?.cancelAt
    ? t("Your subscription will end on {date}.", {
        date: format.dateTime(new Date(subscription.cancelAt), {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      })
    : null;

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
    <PlanList
      cancelMessage={cancelMessage}
      currentPlan={currentPlan}
      descriptions={descriptions}
      plans={plans}
      titles={titles}
    />
  );
}

export function SubscriptionPlansSkeleton() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <Skeleton className="h-9 w-48" />

      <div className="flex flex-col gap-3">
        {Array.from({ length: SUBSCRIPTION_PLANS.length }, (_, i) => (
          <PlanRowSkeleton key={i} />
        ))}
      </div>

      <Skeleton className="h-9 w-32 sm:self-end" />
    </div>
  );
}

function PlanRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-4">
      <div className="flex flex-1 flex-col gap-1">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-48" />
      </div>

      <Skeleton className="h-4 w-16" />
      <Skeleton className="size-4 rounded-full" />
    </div>
  );
}
