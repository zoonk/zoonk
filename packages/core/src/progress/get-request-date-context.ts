import "server-only";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { headers } from "next/headers";

const DEFAULT_TIME_ZONE = "UTC";
const VERCEL_TIME_ZONE_HEADER = "x-vercel-ip-timezone";

type RequestProgressDateContext = { currentDate: Date; currentInstant: Date; timeZone: string };

/**
 * Accepts only a valid IANA timezone from the hosting request so progress
 * calculations never trust an unchecked location value.
 */
function getValidTimeZone(vercelTimeZone: string | null): string {
  return vercelTimeZone && isValidTimeZone(vercelTimeZone) ? vercelTimeZone : DEFAULT_TIME_ZONE;
}

/**
 * Captures one instant, validated timezone, and matching learner-local date so
 * every progress capability in the same render tree uses one clock.
 */
export async function getRequestProgressDateContext(): Promise<RequestProgressDateContext> {
  "use cache: private";

  const requestHeaders = await headers();
  const currentInstant = new Date();
  const timeZone = getValidTimeZone(requestHeaders.get(VERCEL_TIME_ZONE_HEADER));

  return {
    currentDate: getDateInTimeZone({ date: currentInstant, timeZone }),
    currentInstant,
    timeZone,
  };
}
