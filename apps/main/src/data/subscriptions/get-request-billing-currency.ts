import "server-only";
import { getBillingCurrency } from "@/lib/billing-currency";
import { headers } from "next/headers";

/** The current request's billing currency, private because it comes from the request's headers. */
export async function getRequestBillingCurrency(): Promise<string> {
  "use cache: private";
  return getBillingCurrency(await headers());
}
