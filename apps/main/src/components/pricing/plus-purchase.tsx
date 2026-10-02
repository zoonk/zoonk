"use client";

import { Link } from "@/i18n/navigation";
import { authClient } from "@zoonk/auth/client";
import { trackEvent } from "@zoonk/core/analytics/client";
import { Badge } from "@zoonk/ui/components/badge";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Card } from "@zoonk/ui/components/card";
import { cn } from "@zoonk/ui/lib/utils";
import { type PriceInfo, formatPrice } from "@zoonk/utils/currency";
import { logError } from "@zoonk/utils/logger";
import { Loader2Icon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { type ReactNode, useState } from "react";
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
 * The billing period switch is a segmented control, like the card filters: a muted track (glass
 * in Fun) with the chosen period raised on the page background, so it reads on the card in light
 * mode too, where the card and the page share one color.
 */
function getPeriodOptionClass(isSelected: boolean) {
  return isSelected ? "shadow-sm in-data-[mode=fun]:fun-inv" : "text-muted-foreground";
}

/**
 * The one Plus offer: its price with a transparent billing choice, what it gives (`benefits`,
 * rendered on the server), and the next step. The CTA changes only at the authentication
 * boundary: visitors try it free (or get Plus by signing in first), guests sign in first, while
 * signed-in free users start checkout. Signing in creates the account, so "Get Plus" works for
 * anyone without one. Subscribers never see it: the subscription page shows their plan instead.
 */
export function PlusPurchase({
  benefits,
  monthlyPrice,
  viewerState,
  yearlyPrice,
}: {
  benefits: ReactNode;
  monthlyPrice: PriceInfo | null;
  viewerState: PlusViewerState;
  yearlyPrice: PriceInfo | null;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const t = useExtracted();
  const locale = useLocale();
  const yearlyComparison = getYearlyPriceComparison({ monthlyPrice, yearlyPrice });
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
    <Card className="gap-5 px-5 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{t("Plus")}</h2>

        <div
          aria-label={t("Billing period")}
          className="bg-muted in-data-[mode=fun]:fun-glass flex rounded-4xl p-1"
          role="group"
        >
          <Button
            aria-pressed={period === "monthly"}
            className={cn("flex-1 sm:flex-initial", getPeriodOptionClass(period === "monthly"))}
            onClick={() => setPeriod("monthly")}
            size="sm"
            type="button"
            variant={period === "monthly" ? "outline" : "ghost"}
          >
            {t("Monthly")}
          </Button>

          <Button
            aria-pressed={period === "yearly"}
            className={cn(
              "flex-1 gap-2 sm:flex-initial",
              getPeriodOptionClass(period === "yearly"),
            )}
            disabled={!yearlyPrice}
            onClick={() => setPeriod("yearly")}
            size="sm"
            type="button"
            variant={period === "yearly" ? "outline" : "ghost"}
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
      </div>

      <BillingPriceSummary monthlyPrice={monthlyPrice} period={period} yearlyPrice={yearlyPrice} />

      {benefits}

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
            {t("Get Plus")}
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
          {t("Cancel anytime.")}
        </p>
      </div>

      {requestState === "error" && (
        <p className="text-destructive text-sm" role="alert">
          {t("Unable to start checkout. Contact us at hello@zoonk.com")}
        </p>
      )}
    </Card>
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
