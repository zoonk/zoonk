import "server-only";
import { cacheLife } from "next/cache";

/** One reference instant for GET facts; each goal derives its local day in its own stored zone. */
export async function getRequestInstant(): Promise<Date> {
  "use cache: private";

  cacheLife({ stale: Infinity });
  return new Date();
}
