"use client";

import { readVisitorCountry } from "@/lib/visitor-country";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { DEFAULT_CURRENCY, countryToCurrency } from "@zoonk/utils/currency";
import { type ReactNode } from "react";
import { BILLING_CURRENCY_CSS, BILLING_CURRENCY_SCRIPT } from "./billing-currency-script";

/**
 * Where prices show in the reader's currency, picked in the browser from the country the proxy
 * keeps (`VISITOR_COUNTRY_COOKIE`), so the pages that show prices stay static. On a page load the
 * inline script picks it before the prices are drawn; hydration keeps that (the attribute differs
 * from the server's on purpose) and the render after it sets the same one. On a client navigation
 * the script doesn't run and the first render already has the currency, so its type makes the
 * script inert data there.
 */
export function BillingCurrencyScope({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const currency = useIsMounted() ? countryToCurrency(readVisitorCountry() ?? "") : null;

  return (
    <div
      className={className}
      data-billing-currency={currency ?? DEFAULT_CURRENCY}
      suppressHydrationWarning
    >
      <script
        // oxlint-disable-next-line react/no-danger -- a fixed script built from constants, nothing the reader sends.
        dangerouslySetInnerHTML={{ __html: BILLING_CURRENCY_SCRIPT }}
        type={currency === null ? undefined : "application/json"}
      />

      <style href="billing-currency" precedence="default">
        {BILLING_CURRENCY_CSS}
      </style>

      {children}
    </div>
  );
}
