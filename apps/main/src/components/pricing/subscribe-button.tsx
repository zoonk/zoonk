"use client";

import { authClient } from "@zoonk/auth/client";
import { trackEvent } from "@zoonk/core/analytics/client";
import { Button } from "@zoonk/ui/components/button";
import { logError } from "@zoonk/utils/logger";
import { Loader2Icon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useState } from "react";
import { PLUS_CTA_CLASS } from "./plus-cta";

type RequestState = "error" | "idle" | "loading";
type StripeLocaleOverride = "de" | "es" | "fr" | "pt-BR";

/**
 * Stripe can infer English and unknown locales from the browser. The supported non-English app
 * locales need an explicit mapping, including Stripe's distinct Brazilian Portuguese code.
 */
const STRIPE_LOCALE_OVERRIDES: Readonly<Record<string, StripeLocaleOverride | undefined>> = {
  de: "de",
  es: "es",
  fr: "fr",
  pt: "pt-BR",
};

/** The period the billing switch has checked (its radios, `billingSwitch`): monthly by default. */
function readBillingPeriod(billingSwitch: string): "monthly" | "yearly" {
  const checked = document.querySelector<HTMLInputElement>(
    `input[name="${billingSwitch}"]:checked`,
  );

  return checked?.value === "yearly" ? "yearly" : "monthly";
}

/**
 * "Subscribe" for a signed-in learner on the free plan: checkout starts with the period the card's
 * billing switch shows, which the server rendered as native radios. Stripe confirms the price.
 */
export function SubscribeButton({ billingSwitch }: { billingSwitch: string }) {
  const t = useExtracted();
  const locale = useLocale();
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const isLoading = requestState === "loading";

  const subscribe = async () => {
    const period = readBillingPeriod(billingSwitch);
    setRequestState("loading");

    trackEvent({
      name: "Subscription Checkout Started",
      properties: { billingPeriod: period, plan: "plus" },
    });

    const { error } = await authClient.subscription.upgrade({
      annual: period === "yearly",
      cancelUrl: "/subscription",
      locale: STRIPE_LOCALE_OVERRIDES[locale],
      plan: "plus",
      successUrl: "/subscription?stripe_checkout=complete",
    });

    if (error) {
      setRequestState("error");
      logError("Subscription upgrade failed", { error });
    }
  };

  return (
    <>
      <Button
        aria-busy={isLoading}
        className={PLUS_CTA_CLASS}
        disabled={isLoading}
        onClick={subscribe}
        size="lg"
        type="button"
      >
        {isLoading && <Loader2Icon aria-hidden="true" className="animate-spin" />}
        {t("Subscribe")}
      </Button>

      {requestState === "error" && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("Unable to start checkout. Contact us at hello@zoonk.com")}
        </p>
      )}
    </>
  );
}
