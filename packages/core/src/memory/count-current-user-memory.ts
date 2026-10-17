import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getMemoryCacheTag } from "../cache/tags";
import { getRequestInstant } from "../learner/facts/request-instant";
import { getSession } from "../users/get-session";
import { currentFactsWhere } from "./_utils/memory-fact-view";

/** How many current facts the learner's Memory screen lists, including while memory is off. */
export async function countCurrentUserMemory(): Promise<number | null> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;
  cacheTag(getMemoryCacheTag(userId));

  const now = await getRequestInstant();
  return prisma.memoryFact.count({ where: currentFactsWhere({ now, userId }) });
}
