import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLearningProfileCacheTag, getMemoryCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { isMemoryEnabled } from "./_utils/memory-access";
import { currentFactsWhere, toMemoryFactView } from "./_utils/memory-fact-view";
import { type MemoryView } from "./memory-contract";

/** The Memory screen: the memory switch and every fact Zoonk keeps about the learner, newest first. */
export async function getCurrentUserMemory(): Promise<MemoryView | null> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;

  cacheTag(getMemoryCacheTag(userId), getLearningProfileCacheTag(userId));

  const [enabled, facts] = await Promise.all([
    isMemoryEnabled(userId),
    prisma.memoryFact.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      where: currentFactsWhere({ now: new Date(), userId }),
    }),
  ]);

  return { enabled, facts: facts.map((fact) => toMemoryFactView(fact)) };
}
