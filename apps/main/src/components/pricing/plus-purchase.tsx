"use client";

import { Link } from "@/i18n/navigation";
import { authClient } from "@zoonk/auth/client";
import { trackEvent } from "@zoonk/core/analytics/client";
import { Badge } from "@zoonk/ui/components/badge";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { CyclingText } from "@zoonk/ui/components/cycling-text";
import { cn } from "@zoonk/ui/lib/utils";
import { type PriceInfo, formatPrice } from "@zoonk/utils/currency";
import { logError } from "@zoonk/utils/logger";
import { Loader2Icon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useState } from "react";
import { type BillingPeriod, BillingPriceSummary } from "./billing-price-summary";
import { getYearlyPriceComparison } from "./billing-prices";
import { GuardianApprovalRequest } from "./guardian-approval-request";
import { PLUS_CTA_CLASS } from "./plus-cta";

type RequestState = "error" | "idle" | "loading";
type StripeLocaleOverride = "de" | "es" | "fr" | "pt-BR";

/**
 * Who is looking at the offer. A `guest` tried lessons without an account inside the app; a
 * `visitor` is on the public pricing page and can start free before deciding.
 */
export type PlusViewerState =
  | { status: "free" }
  | { status: "guardian" }
  | { status: "guest" }
  | { status: "visitor" };

const STRIPE_LOCALE_OVERRIDES: Readonly<Record<string, StripeLocaleOverride | undefined>> = {
  de: "de",
  es: "es",
  fr: "fr",
  pt: "pt-BR",
};

/**
 * Things that cost more than a month of Plus (about $19, R$ 60–100 or €19), so the line stays
 * true wherever it's read. The first lands the point and is the one screen readers hear. Each is
 * its own translation message; the rail stacks them all invisibly in one grid cell under the
 * cycling one, so the box fits the longest in any language instead of clipping it.
 */
function useValueComparisons() {
  const t = useExtracted();

  return [
    t("a month of private tutoring"),
    t("a textbook you'll open twice"),
    t("a fancy dinner for two"),
    t("front-row concert tickets"),
    t("a brand-new video game"),
    t("sneakers you didn't need"),
    t("a speeding ticket"),
    t("fixing a cracked phone screen"),
    t("a weekend getaway"),
    t("a cab from the airport"),
    t("a birthday cake for the whole office"),
    t("noise-canceling headphones"),
    t("a designer candle you don't need"),
    t("a pile of forgotten subscriptions"),
    t("a drawer of socks with tiny avocados"),
  ] as const;
}

/**
 * The purchase rail beside the comparison: a transparent billing choice without bringing back
 * the plan-selection grid. The CTA changes only at the authentication boundary: visitors start
 * free (or log in to subscribe), guests log in first, while signed-in free users start checkout.
 * Subscribers never see it: the subscription page shows their plan instead.
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
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const t = useExtracted();
  const locale = useLocale();
  const yearlyComparison = getYearlyPriceComparison({ monthlyPrice, yearlyPrice });
  const valueComparisons = useValueComparisons();
  const isLoading = requestState === "loading";

  const yearlySavingsAmount = yearlyComparison
    ? formatPrice(yearlyComparison.savings.amount, yearlyComparison.savings.currency, locale)
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

    trackEvent({
      name: "Subscription Checkout Started",
      properties: { billingPeriod: period, plan: "plus" },
    });

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
    <aside className="bg-muted/40 order-first flex flex-col gap-5 border-b px-5 py-6 sm:px-8 sm:py-8 lg:order-last lg:border-b-0 lg:border-l">
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
              <Badge aria-hidden="true" className="text-foreground font-mono" variant="success">
                −{yearlySavingsAmount}
              </Badge>
              <span className="sr-only">{savingsLabel}</span>
            </>
          )}
        </Button>
      </div>

      <BillingPriceSummary monthlyPrice={monthlyPrice} period={period} yearlyPrice={yearlyPrice} />

      {monthlyPrice && (
        <div className="border-y py-4">
          <p className="text-muted-foreground text-sm">
            {t("Investing in your future is cheaper than")}
          </p>

          <div className="grid text-xl leading-tight font-semibold tracking-tight *:col-start-1 *:row-start-1">
            <span className="sr-only">{valueComparisons[0]}</span>

            {valueComparisons.map((comparison) => (
              <span aria-hidden="true" className="invisible" key={comparison}>
                {comparison}
              </span>
            ))}

            <CyclingText aria-hidden="true">{valueComparisons}</CyclingText>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {viewerState.status === "visitor" && (
          <Link className={cn(buttonVariants({ size: "lg" }), PLUS_CTA_CLASS)} href="/start">
            {t("Try free")}
          </Link>
        )}

        {(viewerState.status === "guest" || viewerState.status === "visitor") && (
          <Link
            className={cn(
              buttonVariants({
                size: "lg",
                variant: viewerState.status === "visitor" ? "outline" : "default",
              }),
              PLUS_CTA_CLASS,
            )}
            href="/login?next=%2Fsubscription"
            prefetch={false}
          >
            {t("Log in to subscribe")}
          </Link>
        )}

        {viewerState.status === "guardian" && <GuardianApprovalRequest />}

        {viewerState.status === "free" && (
          <Button
            aria-busy={isLoading}
            className={PLUS_CTA_CLASS}
            disabled={isLoading}
            onClick={handleSubscribe}
            size="lg"
            type="button"
          >
            {isLoading && <Loader2Icon aria-hidden="true" className="animate-spin" />}
            {t("Subscribe")}
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
    </aside>
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
