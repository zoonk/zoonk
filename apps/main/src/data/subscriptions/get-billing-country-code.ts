import "server-only";
import { getCountryFromAcceptLanguage } from "@zoonk/utils/locale";
import { headers } from "next/headers";

/**
 * Billing uses Vercel's country header when available and falls back to the
 * request language. The value stays private because both inputs come from the
 * current browser request, while Stripe prices remain public data.
 */
export async function getBillingCountryCode() {
  "use cache: private";

  const requestHeaders = await headers();

  return (
    requestHeaders.get("x-vercel-ip-country") ??
    getCountryFromAcceptLanguage(requestHeaders.get("accept-language"))
  );
}
