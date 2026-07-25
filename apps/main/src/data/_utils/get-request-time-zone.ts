import "server-only";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { headers } from "next/headers";

const DEFAULT_TIME_ZONE = "UTC";
const VERCEL_TIME_ZONE_HEADER = "x-vercel-ip-timezone";

type ProgressDateContext = { currentDate: Date; timeZone: string };

/**
 * Vercel's validated IANA timezone keeps progress dates aligned with the
 * learner's request, while UTC keeps local and non-Vercel runs deterministic.
 */
function getValidTimeZone(vercelTimeZone: string | null): string {
  if (vercelTimeZone && isValidTimeZone(vercelTimeZone)) {
    return vercelTimeZone;
  }

  return DEFAULT_TIME_ZONE;
}

/** Resolves the request timezone and its current date from one server instant. */
async function resolveRequestProgressDateContext(): Promise<ProgressDateContext> {
  const requestHeaders = await headers();
  const timeZone = getValidTimeZone(requestHeaders.get(VERCEL_TIME_ZONE_HEADER));

  return { currentDate: getDateInTimeZone({ date: new Date(), timeZone }), timeZone };
}

/**
 * Keeping the request values in one private-cache entry prevents a date from
 * one timezone being paired with another timezone's instant boundaries.
 */
export async function getRequestProgressDateContext(): Promise<ProgressDateContext> {
  "use cache: private";

  return resolveRequestProgressDateContext();
}

/** Returns the validated timezone used by date-sensitive progress queries. */
export async function getRequestTimeZone(): Promise<string> {
  const context = await getRequestProgressDateContext();

  return context.timeZone;
}
