import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getSavedMindMapsCacheTag } from "../../cache/tags";

/** GET-only fact: every map the learner saved, from any goal, oldest first. */
export async function readSavedMindMaps(userId: string) {
  "use cache: private";

  cacheTag(getSavedMindMapsCacheTag(userId));

  return prisma.savedMindMap.findMany({
    orderBy: { createdAt: "asc" },
    select: { goalId: true, kind: true, targetId: true, title: true },
    where: { userId },
  });
}
