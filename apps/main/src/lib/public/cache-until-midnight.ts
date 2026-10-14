import "server-only";
import { cacheLife } from "next/cache";
import { getSecondsToMidnight } from "./calendar-day";

/** How often a day's cache is worked out again within its day (seconds): its data can change. */
const REVALIDATE_SECONDS = 3600;

/** How long a browser keeps a page it fetched before asking again (seconds). */
const STALE_SECONDS = 300;

/** How long past its midnight a day's cache is still served while the next day's is worked out. */
const NEXT_DAY_SECONDS = 86_400;

/**
 * Inside a `"use cache"` scope that reads today's date: worked out again every hour, and at the
 * next midnight in any of `timeZones` (the days it counts in). Nobody waits for that: the day's copy
 * is kept a day longer, so the first visitor after midnight gets it at once, a countdown one day
 * behind for that one view, while the new day's is worked out behind it. A browser may also keep
 * a page it fetched for five minutes past midnight.
 */
export function cacheUntilMidnight(timeZones: readonly string[]) {
  const now = new Date();

  const toMidnight = Math.min(
    ...timeZones.map((timeZone) => getSecondsToMidnight({ now, timeZone })),
  );

  cacheLife({
    expire: toMidnight + NEXT_DAY_SECONDS,
    revalidate: Math.max(1, Math.min(REVALIDATE_SECONDS, toMidnight)),
    stale: STALE_SECONDS,
  });
}
