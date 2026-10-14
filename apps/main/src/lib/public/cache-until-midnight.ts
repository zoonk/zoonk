import "server-only";
import { cacheLife } from "next/cache";
import { getSecondsToMidnight } from "./calendar-day";

/** How often a day's cache is worked out again within its day (seconds): its data can change. */
const REVALIDATE_SECONDS = 3600;

/**
 * How long a router keeps a prefetched page before asking again (seconds), and the shortest life
 * a day's cache gets: Next leaves a cache that expires sooner out of the page's prerender.
 */
const STALE_SECONDS = 300;

/**
 * Inside a `"use cache"` scope that reads today's date: worked out again every hour, and dropped at
 * the next midnight in any of `timeZones` (the days it counts in), or in five minutes when that
 * midnight is sooner (the shortest life a prerendered cache keeps). So a day's countdown may
 * outlast midnight by a few minutes, plus the five a browser may keep a page it fetched.
 */
export function cacheUntilMidnight(timeZones: readonly string[]) {
  const now = new Date();

  const toMidnight = Math.min(
    ...timeZones.map((timeZone) => getSecondsToMidnight({ now, timeZone })),
  );

  const expire = Math.max(STALE_SECONDS, toMidnight);
  const revalidate = Math.min(REVALIDATE_SECONDS, expire - 1);

  cacheLife({ expire, revalidate, stale: Math.min(STALE_SECONDS, revalidate) });
}
