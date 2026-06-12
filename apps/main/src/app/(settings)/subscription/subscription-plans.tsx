import { getCurrentUserAnalyticsDisabled } from "@/data/users/get-current-user-analytics-disabled";
import { getStripePrices } from "@zoonk/core/auth/stripe-prices";
import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { prisma } from "@zoonk/db";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { countryToCurrency } from "@zoonk/utils/currency";
import { getCountryFromAcceptLanguage } from "@zoonk/utils/locale";
import { SUBSCRIPTION_PLANS, isWebManagedSubscriptionProvider } from "@zoonk/utils/subscription";
import { getExtracted, getFormatter } from "next-intl/server";
import { headers } from "next/headers";
import { ManagedSubscription } from "./managed-subscription";
import { PlanList } from "./plan-list";
import { SubscriptionConversionTracker } from "./subscription-conversion-tracker";

export async function SubscriptionPlans({
  searchParams,
}: {
  searchParams: PageProps<"/subscription">["searchParams"];
}) {
  const requestHeaders = await headers();
  const query = await searchParams;
  const t = await getExtracted();
  const format = await getFormatter();
  const stripeCheckoutCompleted = query.stripe_checkout === "complete";

  const countryCode =
    requestHeaders.get("x-vercel-ip-country") ??
    getCountryFromAcceptLanguage(requestHeaders.get("accept-language"));

  const currency = countryToCurrency(countryCode);

  const lookupKeys: string[] = SUBSCRIPTION_PLANS.flatMap((plan) =>
    [plan.lookupKey, plan.annualLookupKey].filter((key) => key !== null),
  );

  const [subscription, priceMap, analyticsDisabled] = await Promise.all([
    getCurrentSubscription(requestHeaders),
    getStripePrices(lookupKeys, currency),
    getCurrentUserAnalyticsDisabled(),
  ]);

  const titles: Record<string, string> = {
    free: t("Free"),
    max: t("Max"),
    plus: t("Plus"),
    pro: t("Pro"),
  };

  const currentPlan = subscription?.plan ?? null;

  const cancelDate = getSubscriptionDate({ date: subscription?.cancelAt ?? null, format });

  const periodEndDate = getSubscriptionDate({
    date: subscription?.cancelAt ? null : (subscription?.periodEnd ?? null),
    format,
  });

  const cancelMessage = cancelDate
    ? t("Your subscription will end on {date}.", { date: cancelDate })
    : null;

  const periodMessage = periodEndDate
    ? t("Current billing period ends on {date}.", { date: periodEndDate })
    : null;

  const activeStripeSubscriptionId = subscription?.provider === "stripe" ? subscription.id : null;

  if (subscription && !isWebManagedSubscriptionProvider(subscription.provider)) {
    return (
      <>
        <SubscriptionConversionTracker
          activeSubscriptionId={activeStripeSubscriptionId}
          analyticsDisabled={analyticsDisabled}
          stripeCheckoutCompleted={stripeCheckoutCompleted}
        />
        <ManagedSubscription
          cancelMessage={cancelMessage}
          periodMessage={periodMessage}
          planTitle={titles[subscription.plan] ?? subscription.plan}
          provider={subscription.provider}
        />
      </>
    );
  }

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

  const descriptions: Record<string, string> = {
    free: t("Limited lessons with ads"),
    max: t("Personalized lessons, smartest AI"),
    plus: t("Unlimited lessons, no ads"),
    pro: t("Personalized lessons, fast AI"),
  };

  return (
    <>
      <SubscriptionConversionTracker
        activeSubscriptionId={activeStripeSubscriptionId}
        analyticsDisabled={analyticsDisabled}
        stripeCheckoutCompleted={stripeCheckoutCompleted}
      />
      <PlanList
        cancelMessage={cancelMessage}
        currentPlan={currentPlan}
        descriptions={descriptions}
        plans={plans}
        titles={titles}
      />
    </>
  );
}

/**
 * Better Auth still decides which row is currently active. Once we know that
 * row, Prisma can read the extra provider field we added around Better Auth's schema.
 */
async function getCurrentSubscription(requestHeaders: Headers) {
  const activeSubscription = await getActiveSubscription(requestHeaders);

  if (!activeSubscription) {
    return null;
  }

  return prisma.subscription.findUnique({ where: { id: activeSubscription.id } });
}

/**
 * Formatting the subscription date in one place keeps the billing copy focused
 * on the state change instead of repeating date-shape details in each message.
 */
function getSubscriptionDate({
  date,
  format,
}: {
  date: Date | null;
  format: Awaited<ReturnType<typeof getFormatter>>;
}) {
  if (!date) {
    return null;
  }

  return format.dateTime(new Date(date), { day: "numeric", month: "long", year: "numeric" });
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
