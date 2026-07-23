import "server-only";
import { headers } from "next/headers";

const DEFAULT_TIME_ZONE = "UTC";
const VERCEL_TIME_ZONE_HEADER = "x-vercel-ip-timezone";

/**
 * Vercel derives an IANA timezone from the visitor's request location. Using it
 * keeps date-only progress views aligned with the learner's day while the UTC
 * fallback makes local development and non-Vercel deployments deterministic.
 * The browser-only cache lets runtime prefetching resolve this request-specific
 * value before navigation without storing it in the shared server cache.
 */
export async function getRequestTimeZone(): Promise<string> {
  "use cache: private";

  const requestHeaders = await headers();

  return requestHeaders.get(VERCEL_TIME_ZONE_HEADER) ?? DEFAULT_TIME_ZONE;
}
