import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { type UserProgress, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";

async function findUserProgress(userId: string): Promise<UserProgress | null> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));
  return prisma.userProgress.findUnique({ where: { userId } });
}

/** Returns the authenticated learner's canonical progress row. */
export async function getUserProgress(): Promise<UserProgress | null> {
  const session = await getSession();
  return session ? findUserProgress(session.user.id) : null;
}
