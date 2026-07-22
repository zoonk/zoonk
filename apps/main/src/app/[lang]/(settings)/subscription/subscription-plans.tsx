import { getActiveSubscription } from "@/data/subscriptions/get-active-subscription";
import { getBillingCountryCode } from "@/data/subscriptions/get-billing-country-code";
import { type StripePriceMap, getStripePrices } from "@/data/subscriptions/get-stripe-prices";
import { getCurrentUserAnalyticsDisabled } from "@/data/users/get-current-user-analytics-disabled";
import { getSession } from "@/data/users/get-session";
import { type Subscription, prisma } from "@zoonk/db";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { countryToCurrency } from "@zoonk/utils/currency";
import { TTS_SUPPORTED_LANGUAGE_CODES } from "@zoonk/utils/languages";
import {
  PLUS_PLAN,
  type SubscriptionProvider,
  isWebManagedSubscriptionProvider,
} from "@zoonk/utils/subscription";
import { getExtracted, getFormatter } from "next-intl/server";
import { ManagedSubscription } from "./managed-subscription";
import { PlusPurchase, type PlusViewerState } from "./plus-purchase";
import { SubscriptionConversionTracker } from "./subscription-conversion-tracker";

const LEARNABLE_LANGUAGE_COUNT = TTS_SUPPORTED_LANGUAGE_CODES.length - 1;

export async function SubscriptionPlans({
  searchParams,
}: {
  searchParams: PageProps<"/[lang]/subscription">["searchParams"];
}) {
  const t = await getExtracted();
  const format = await getFormatter();

  const [query, session, subscription, priceMap, analyticsDisabled] = await Promise.all([
    searchParams,
    getSession(),
    getCurrentPlusSubscription(),
    getLocalizedPlusPriceMap(),
    getCurrentUserAnalyticsDisabled(),
  ]);

  const stripeCheckoutCompleted = query.stripe_checkout === "complete";
  const cancelDate = getSubscriptionDate({ date: subscription?.cancelAt ?? null, format });

  const cancelMessage = cancelDate
    ? t("Your subscription will end on {date}.", { date: cancelDate })
    : null;

  if (subscription && !isWebManagedSubscriptionProvider(subscription.provider)) {
    return (
      <ProviderManagedSubscription
        analyticsDisabled={analyticsDisabled}
        provider={subscription.provider}
        stripeCheckoutCompleted={stripeCheckoutCompleted}
        subscription={subscription}
      />
    );
  }

  const { monthlyPrice, yearlyPrice } = getPlusPrices(priceMap);

  const viewerState = getPlusViewerState({
    cancelMessage,
    isAuthenticated: Boolean(session),
    isSubscribed: Boolean(subscription),
  });

  return (
    <>
      {session && (
        <SubscriptionConversionTracker
          activeSubscriptionId={subscription?.id ?? null}
          analyticsDisabled={analyticsDisabled}
          plan={subscription?.plan ?? "free"}
          stripeCheckoutCompleted={stripeCheckoutCompleted}
        />
      )}

      <section
        aria-label={t("Zoonk Plus benefits and pricing")}
        className="grid w-full border-y lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]"
      >
        <ul className="divide-y">
          <li className="grid gap-2 px-1 py-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8 sm:px-4 sm:py-8">
            <h2 className="text-lg font-semibold tracking-tight">{t("Know what to learn next")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t(
                "Tell Zoonk your goal. AI builds a clear, step-by-step course around what you need to learn.",
              )}
            </p>
          </li>

          <li className="grid gap-2 px-1 py-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8 sm:px-4 sm:py-8">
            <h2 className="text-lg font-semibold tracking-tight">
              {t("Keep learning until you get there")}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t(
                "Take as many courses and lessons as you need. Everything is included in one subscription.",
              )}
            </p>
          </li>

          <li className="grid gap-2 px-1 py-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8 sm:px-4 sm:py-8">
            <h2 className="text-lg font-semibold tracking-tight">{t("Speak a new language")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t(
                "Choose from {count, plural, one {# language} other {# languages}} and build the vocabulary, listening, grammar, and pronunciation to use it with confidence.",
                { count: LEARNABLE_LANGUAGE_COUNT },
              )}
            </p>
          </li>
        </ul>

        <PlusPurchase
          monthlyPrice={monthlyPrice}
          viewerState={viewerState}
          yearlyPrice={yearlyPrice}
        />
      </section>
    </>
  );
}

/**
 * Provider-owned subscriptions keep the established management view and its
 * provider-specific dates, links, and support guidance instead of entering the
 * new Stripe sales flow.
 */
async function ProviderManagedSubscription({
  analyticsDisabled,
  provider,
  stripeCheckoutCompleted,
  subscription,
}: {
  analyticsDisabled: boolean;
  provider: Exclude<SubscriptionProvider, "stripe">;
  stripeCheckoutCompleted: boolean;
  subscription: Subscription;
}) {
  const t = await getExtracted();
  const format = await getFormatter();
  const cancelDate = getSubscriptionDate({ date: subscription.cancelAt, format });

  const periodEndDate = getSubscriptionDate({
    date: subscription.cancelAt ? null : subscription.periodEnd,
    format,
  });

  const cancelMessage = cancelDate
    ? t("Your subscription will end on {date}.", { date: cancelDate })
    : null;

  const periodMessage = periodEndDate
    ? t("Current billing period ends on {date}.", { date: periodEndDate })
    : null;

  return (
    <>
      <SubscriptionConversionTracker
        activeSubscriptionId={null}
        analyticsDisabled={analyticsDisabled}
        plan={subscription.plan}
        stripeCheckoutCompleted={stripeCheckoutCompleted}
      />
      <ManagedSubscription
        cancelMessage={cancelMessage}
        periodMessage={periodMessage}
        planTitle={t("Plus")}
        provider={provider}
      />
    </>
  );
}

/**
 * Plus is the only purchasable plan, so pricing never needs to fetch or reason
 * about a second paid option.
 */
function getPlusLookupKeys() {
  return [PLUS_PLAN.lookupKey, PLUS_PLAN.annualLookupKey];
}

/**
 * Country detection is private request data, but Stripe prices are public.
 * Keeping the public fetch outside the private function preserves price reuse
 * while starting the country-to-price dependency alongside the other reads.
 */
async function getLocalizedPlusPriceMap() {
  const countryCode = await getBillingCountryCode();

  return getStripePrices({
    currency: countryToCurrency(countryCode),
    lookupKeys: getPlusLookupKeys(),
  });
}

/**
 * Resolves the two displayed Plus prices without making the client understand
 * Stripe lookup keys.
 */
function getPlusPrices(priceMap: StripePriceMap) {
  const monthlyPrice = priceMap.get(PLUS_PLAN.lookupKey) ?? null;
  const yearlyPrice = priceMap.get(PLUS_PLAN.annualLookupKey) ?? null;

  return { monthlyPrice, yearlyPrice };
}

/**
 * The public offer needs one explicit state so its client boundary cannot infer
 * authentication from missing subscription data. Scheduled cancellations stay
 * separate because they no longer need another cancel action.
 */
function getPlusViewerState({
  cancelMessage,
  isAuthenticated,
  isSubscribed,
}: {
  cancelMessage: string | null;
  isAuthenticated: boolean;
  isSubscribed: boolean;
}): PlusViewerState {
  if (isSubscribed && cancelMessage) {
    return { message: cancelMessage, status: "ending" };
  }

  if (isSubscribed) {
    return { status: "active" };
  }

  if (isAuthenticated) {
    return { status: "free" };
  }

  return { status: "guest" };
}

/**
 * Better Auth decides which row is currently active. Prisma then loads the
 * provider only when that row belongs to Plus, the sole paid plan.
 */
async function getCurrentPlusSubscription(): Promise<Subscription | null> {
  const activeSubscription = await getActiveSubscription();

  if (!activeSubscription) {
    return null;
  }

  return prisma.subscription.findUnique({
    where: { id: activeSubscription.id, plan: PLUS_PLAN.name },
  });
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
    <div
      aria-hidden="true"
      className="grid w-full border-y lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]"
    >
      <div className="divide-y">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            className="grid gap-3 px-1 py-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8 sm:px-4 sm:py-8"
            key={index}
          >
            <Skeleton className="h-5 w-40" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-muted/40 order-first flex min-h-72 flex-col gap-6 border-b px-5 py-6 sm:px-8 sm:py-8 lg:order-last lg:border-b-0 lg:border-l">
        <div className="flex justify-between">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-9 w-full rounded-4xl" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="mt-auto h-10 w-full rounded-4xl" />
      </div>
    </div>
  );
}
