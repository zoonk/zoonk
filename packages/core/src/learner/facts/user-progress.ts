import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";

/** GET-only fact; authenticated capabilities must derive the userId. */
export async function readUserProgress(userId: string) {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId));

  return prisma.userProgress.findUnique({ where: { userId } });
}
