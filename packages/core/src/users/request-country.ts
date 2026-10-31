import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { getRequestCountry } from "@zoonk/utils/locale-request";
import { headers } from "next/headers";

/** Null outside a request, such as in a workflow step. */
export async function findRequestCountry(): Promise<string | null> {
  const { data: requestHeaders } = await safeAsync(() => headers());
  return requestHeaders ? getRequestCountry(requestHeaders) : null;
}
