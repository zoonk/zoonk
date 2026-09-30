import "server-only";
import { detectDeeperPreference } from "@zoonk/ai/tasks/v2/memory/depth";
import { type MemoryCategory, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearningProfileCacheTag } from "../../cache/tags";
import { type MemoryChange } from "../memory-contract";

const PREFERENCES: MemoryCategory = "preferences";

/**
 * Keeps `memoryAsksDeeper` in step with the learner's active preference notes, so lessons open
 * the "Go deeper" version first when memory says they asked for a more technical register. A model
 * reads the notes only when there are some; a learner without a profile has nothing to update.
 */
async function refreshMemoryDepthPreference(userId: string): Promise<boolean> {
  const now = new Date();

  const facts = await prisma.memoryFact.findMany({
    orderBy: { createdAt: "asc" },
    select: { statement: true },
    where: {
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      category: PREFERENCES,
      status: "active",
      userId,
    },
  });

  const verdict =
    facts.length > 0
      ? await detectDeeperPreference({
          analytics: { contentScope: "personal", distinctId: userId },
          preferences: facts.map((fact) => fact.statement),
        })
      : null;

  const asksDeeper = verdict?.asksDeeper ?? false;

  const { count } = await prisma.userLearningProfile.updateMany({
    data: { memoryAsksDeeper: asksDeeper },
    where: { memoryAsksDeeper: !asksDeeper, userId },
  });

  if (count > 0) {
    revalidateCacheTags([getLearningProfileCacheTag(userId)]);
  }

  return asksDeeper;
}

/**
 * Refreshes now, for workflows and chats that run outside a request's lifetime. Refreshing never
 * fails the memory change that asked for it.
 */
export async function refreshDepthPreferenceNow(userId: string): Promise<void> {
  const { error } = await safeAsync(() => refreshMemoryDepthPreference(userId));

  if (error) {
    logError(`Could not refresh the depth preference of learner ${userId}.`, error);
  }
}

/** Whether a memory change added, replaced or removed a preference note. */
export function touchesPreferences(changes: readonly MemoryChange[]): boolean {
  return changes.some(
    (change) => change.fact?.category === PREFERENCES || change.previous?.category === PREFERENCES,
  );
}

/** Refreshes after the response, for capabilities the learner is waiting on. */
export function scheduleDepthPreferenceRefresh(userId: string): void {
  after(() => refreshDepthPreferenceNow(userId));
}
