import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getAllowanceCacheTag } from "../../cache/tags";
import { type UsageTotals, loadUsageTotals } from "../../entitlements/_utils/usage-counts";
import { getRequestInstant } from "./request-instant";

/** GET-only fact; a claim counts fresh under the learner's lock. */
export async function readUsageTotals(userId: string): Promise<UsageTotals> {
  "use cache: private";

  cacheTag(getAllowanceCacheTag(userId));

  return loadUsageTotals({ client: prisma, now: await getRequestInstant(), userId });
}
