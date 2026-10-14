import "server-only";
import { cacheLife } from "next/cache";

/**
 * When the page's private reads ran, in milliseconds since the epoch. Read inside the same private
 * cache as the page's data, so a prefetched copy keeps the time it was prefetched and the page can
 * tell how old the copy it shows is (`useRefreshWhenOld`).
 */
export async function getReadAt(): Promise<number> {
  "use cache: private";
  cacheLife({ stale: Infinity });
  return Date.now();
}
