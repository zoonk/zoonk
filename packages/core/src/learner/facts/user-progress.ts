import "server-only";
import { prisma } from "@zoonk/db";
import { cacheLife, cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";

/** Internal persisted GET fact; authenticated callers derive the actor and own any projection. */
export async function readUserProgress(userId: string) {
  "use cache: private";

  cacheLife({ stale: Infinity });
  cacheTag(getUserProgressCacheTag(userId));

  return prisma.userProgress.findUnique({ where: { userId } });
}
