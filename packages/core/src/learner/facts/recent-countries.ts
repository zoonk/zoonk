import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag } from "../../cache/tags";
import { type RecentCountries, loadRecentCountries } from "../../goals/_utils/country-suggestions";

/** GET-only fact behind the capability's authorization; write responses read it fresh. */
export async function readRecentCountries(userId: string): Promise<RecentCountries> {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId));

  return loadRecentCountries(userId);
}
