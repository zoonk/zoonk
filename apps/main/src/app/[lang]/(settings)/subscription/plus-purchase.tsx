"use client";

import { Link } from "@/i18n/navigation";
import { trackSubscriptionCheckoutStarted } from "@/lib/track-events";
import { authClient } from "@zoonk/core/auth/client";
import { Badge } from "@zoonk/ui/components/badge";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { CyclingText } from "@zoonk/ui/components/cycling-text";
import { cn } from "@zoonk/ui/lib/utils";
import { type PriceInfo, formatPrice } from "@zoonk/utils/currency";
import { logError } from "@zoonk/utils/logger";
import { Loader2Icon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useState } from "react";
import { getYearlySavings } from "./_utils/billing-savings";

type BillingPeriod = "monthly" | "yearly";
type RequestState = "error" | "idle" | "loading";
type StripeLocaleOverride = "de" | "es" | "fr" | "pt-BR";

export type PlusViewerState =
  | { status: "active" }
  | { status: "ending"; message: string }
  | { status: "free" }
  | { status: "guest" };

const STRIPE_LOCALE_OVERRIDES: Readonly<Record<string, StripeLocaleOverride | undefined>> = {
  de: "de",
  es: "es",
  fr: "fr",
  pt: "pt-BR",
};

/**
 * Keeps every comparison as its own translation message while letting the UI
 * render them through one shared animation instead of duplicating markup and
 * Tailwind classes for every new example.
 */
function useValueComparisons() {
  const t = useExtracted();

  return [
    t("a pizza"),
    t("a couple of beers"),
    t("a toy"),
    t("a movie ticket"),
    t("a fancy coffee"),
    t("a sad airport sandwich"),
    t("a takeaway lunch"),
    t("a paperback"),
    t("a houseplant"),
    t("a phone case"),
    t("a video game skin"),
    t("a candle you don't need"),
    t("a forgotten subscription"),
    t("socks with tiny avocados"),
    t("a planner you'll definitely use"),
  ] as const;
}

/**
 * Keeps the purchase rail focused on the one decision this page now offers.
 * Guest and free users see pricing, while existing subscribers see their
 * current access and the one relevant management action.
 */
export function PlusPurchase({
  monthlyPrice,
  viewerState,
  yearlyPrice,
}: {
  monthlyPrice: PriceInfo | null;
  viewerState: PlusViewerState;
  yearlyPrice: PriceInfo | null;
}) {
  const hasSubscription = viewerState.status === "active" || viewerState.status === "ending";

  return (
    <aside className="bg-muted/40 order-first border-b px-5 py-6 sm:px-8 sm:py-8 lg:order-last lg:border-b-0 lg:border-l">
      {hasSubscription ? (
        <CurrentPlusPurchase viewerState={viewerState} />
      ) : (
        <AvailablePlusPurchase
          monthlyPrice={monthlyPrice}
          viewerState={viewerState}
          yearlyPrice={yearlyPrice}
        />
      )}
    </aside>
  );
}

/**
 * Gives prospective subscribers a transparent billing choice without bringing
 * back the plan-selection grid. The CTA changes only at the authentication
 * boundary: guests log in first, while signed-in free users start checkout.
 */
function AvailablePlusPurchase({
  monthlyPrice,
  viewerState,
  yearlyPrice,
}: {
  monthlyPrice: PriceInfo | null;
  viewerState: Extract<PlusViewerState, { status: "free" | "guest" }>;
  yearlyPrice: PriceInfo | null;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const t = useExtracted();
  const locale = useLocale();
  const price = getSelectedPrice({ monthlyPrice, period, yearlyPrice });
  const yearlySavings = getYearlySavings({ monthlyPrice, yearlyPrice });
  const valueComparisons = useValueComparisons();
  const isLoading = requestState === "loading";
  const priceLabel = price ? formatPrice(price.amount, price.currency, locale) : null;
  const periodLabel = period === "monthly" ? t("per month") : t("per year");

  const yearlySavingsAmount = yearlySavings
    ? formatPrice(yearlySavings.amount, yearlySavings.currency, locale)
    : null;

  const savingsLabel = yearlySavingsAmount
    ? t("Save {amount} every year", { amount: yearlySavingsAmount })
    : null;

  /**
   * Starts checkout only after the server has established that this viewer is
   * signed in. Stripe remains responsible for the final price confirmation.
   */
  const handleSubscribe = async () => {
    setRequestState("loading");
    trackSubscriptionCheckoutStarted({ billingPeriod: period, plan: "plus" });

    const { error } = await authClient.subscription.upgrade({
      annual: period === "yearly",
      cancelUrl: "/subscription",
      locale: getStripeLocaleOverride(locale),
      plan: "plus",
      successUrl: "/subscription?stripe_checkout=complete",
    });

    if (error) {
      setRequestState("error");
      logError("Subscription upgrade failed", { error });
    }
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("Plus")}</h2>
        <Badge variant="secondary">{t("Everything included")}</Badge>
      </div>

      <div
        aria-label={t("Billing period")}
        className="bg-background flex rounded-4xl p-1"
        role="group"
      >
        <Button
          aria-pressed={period === "monthly"}
          className="flex-1"
          onClick={() => setPeriod("monthly")}
          size="sm"
          type="button"
          variant={period === "monthly" ? "secondary" : "ghost"}
        >
          {t("Monthly")}
        </Button>

        <Button
          aria-pressed={period === "yearly"}
          className="flex-1 gap-2"
          disabled={!yearlyPrice}
          onClick={() => setPeriod("yearly")}
          size="sm"
          type="button"
          variant={period === "yearly" ? "secondary" : "ghost"}
        >
          {t("Yearly")}
          {yearlySavingsAmount && (
            <>
              <Badge aria-hidden="true" className="font-mono" variant="success">
                −{yearlySavingsAmount}
              </Badge>
              <span className="sr-only">{savingsLabel}</span>
            </>
          )}
        </Button>
      </div>

      <div className="flex min-h-24 flex-col justify-center gap-1">
        {priceLabel ? (
          <p className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">{priceLabel}</span>
            <span className="text-muted-foreground text-sm">{periodLabel}</span>
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">{t("Price shown at checkout")}</p>
        )}

        <div className="min-h-5">
          {period === "yearly" && savingsLabel && (
            <p className="text-success text-sm font-medium">{savingsLabel}</p>
          )}
        </div>
      </div>

      {monthlyPrice && (
        <div className="border-y py-4">
          <p className="text-muted-foreground text-sm">
            {t("Investing in your future is cheaper than")}
          </p>

          <div className="relative h-14 overflow-hidden">
            <span className="sr-only">{valueComparisons[0]}</span>
            <CyclingText
              aria-hidden="true"
              className="absolute inset-0 flex items-start text-xl leading-tight font-semibold tracking-tight"
            >
              {valueComparisons}
            </CyclingText>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {viewerState.status === "guest" ? (
          <Link
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
            href="/login?next=%2Fsubscription"
            prefetch={false}
          >
            {t("Log in to unlock unlimited learning")}
          </Link>
        ) : (
          <Button
            aria-label={t("Unlock unlimited learning with Zoonk Plus")}
            aria-busy={isLoading}
            className="w-full"
            disabled={isLoading}
            onClick={handleSubscribe}
            size="lg"
            type="button"
          >
            {isLoading && <Loader2Icon aria-hidden="true" className="animate-spin" />}
            {t("Unlock unlimited learning")}
          </Button>
        )}

        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          {t("No per-course fees. Cancel anytime.")}
        </p>
      </div>

      {requestState === "error" && (
        <p className="text-destructive text-sm" role="alert">
          {t("Unable to start checkout. Contact us at hello@zoonk.com")}
        </p>
      )}
    </div>
  );
}

/**
 * Existing subscribers no longer need to select Free to discover cancellation.
 * A subscription that is already ending shows its confirmed date instead of a
 * duplicate cancellation action.
 */
function CurrentPlusPurchase({
  viewerState,
}: {
  viewerState: Extract<PlusViewerState, { status: "active" | "ending" }>;
}) {
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const t = useExtracted();
  const isLoading = requestState === "loading";

  /**
   * Opens Better Auth's Stripe cancellation flow directly from the single-plan
   * page so subscribers do not have to infer that choosing Free means canceling.
   */
  const handleCancel = async () => {
    setRequestState("loading");

    const { error } = await authClient.subscription.cancel({ returnUrl: "/subscription" });

    if (error) {
      setRequestState("error");
      logError("Subscription cancellation failed", { error });
    }
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("Plus")}</h2>
        <Badge variant={viewerState.status === "active" ? "success" : "secondary"}>
          {viewerState.status === "active" ? t("Active") : t("Subscription ending")}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <p className="text-2xl font-semibold tracking-tight">
          {viewerState.status === "active" ? t("Plus is active") : t("Your access is still active")}
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {viewerState.status === "active"
            ? t("Keep moving toward your goals with unlimited courses and lessons.")
            : viewerState.message}
        </p>
      </div>

      {viewerState.status === "active" && (
        <Button
          aria-busy={isLoading}
          className="w-full"
          disabled={isLoading}
          onClick={handleCancel}
          size="lg"
          type="button"
          variant="destructive"
        >
          {isLoading && <Loader2Icon aria-hidden="true" className="animate-spin" />}
          {t("Cancel subscription")}
        </Button>
      )}

      {requestState === "error" && (
        <p className="text-destructive text-sm" role="alert">
          {t("Unable to manage your subscription. Contact us at hello@zoonk.com")}
        </p>
      )}
    </div>
  );
}

/**
 * Stripe can infer English and unknown locales from the browser. The supported
 * non-English app locales need an explicit mapping, including Stripe's distinct
 * Brazilian Portuguese code.
 */
function getStripeLocaleOverride(locale: string): StripeLocaleOverride | undefined {
  return STRIPE_LOCALE_OVERRIDES[locale];
}

/**
 * Keeps the displayed amount and the checkout interval tied to the same
 * explicit billing choice.
 */
function getSelectedPrice({
  monthlyPrice,
  period,
  yearlyPrice,
}: {
  monthlyPrice: PriceInfo | null;
  period: BillingPeriod;
  yearlyPrice: PriceInfo | null;
}) {
  return period === "monthly" ? monthlyPrice : yearlyPrice;
}
