import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLearningProfileCacheTag, getMemoryCacheTag } from "../cache/tags";
import { readLearningProfile } from "../learner/facts/learning-profile";
import { getRequestInstant } from "../learner/facts/request-instant";
import { getSession } from "../users/get-session";
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

  const now = await getRequestInstant();

  const [profile, facts] = await Promise.all([
    readLearningProfile(userId),
    prisma.memoryFact.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      where: currentFactsWhere({ now, userId }),
    }),
  ]);

  return {
    enabled: profile?.memoryEnabled ?? true,
    facts: facts.map((fact) => toMemoryFactView(fact)),
  };
}
