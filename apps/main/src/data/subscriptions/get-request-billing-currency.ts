import "server-only";
import { getBillingCurrency } from "@/lib/billing-currency";
import { headers } from "next/headers";

export async function getRequestBillingCurrency(): Promise<string> {
  "use cache: private";
  return getBillingCurrency(await headers());
}
