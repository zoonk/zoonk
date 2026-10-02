import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLearningProfileCacheTag, getMemoryCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { getMemoryAccess } from "./_utils/memory-access";
import { currentFactsWhere, toMemoryFactView } from "./_utils/memory-fact-view";
import { type MemoryView } from "./memory-contract";

/**
 * The Memory screen: every fact Zoonk keeps about the learner, newest first, the memory switch and
 * the categories their memory may hold. Facts outside those categories (kept before an age answer
 * made the learner's memory narrower) aren't shown and aren't used.
 */
export async function getCurrentUserMemory(): Promise<MemoryView | null> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;

  cacheTag(getMemoryCacheTag(userId), getLearningProfileCacheTag(userId));

  const access = await getMemoryAccess(userId);

  const facts = await prisma.memoryFact.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: {
      ...currentFactsWhere({ now: new Date(), userId }),
      category: { in: access.categories },
    },
  });

  return {
    categories: access.categories,
    enabled: access.enabled,
    facts: facts.map((fact) => toMemoryFactView(fact)),
  };
}
