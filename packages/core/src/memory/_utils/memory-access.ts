import "server-only";
import { type MemoryCategory, prisma } from "@zoonk/db";
import { getAgeGroup } from "@zoonk/utils/age";
import { getProtectionsForAgeGroup } from "../../minors/age-protections";

export type MemoryAccess = {
  /** Whether sensitive facts may ever be kept, when the learner explicitly asks. Adults only. */
  allowSensitive: boolean;
  /** The categories this learner's memory may hold: only goals and learning for minors. */
  categories: MemoryCategory[];
  /** The learner's memory switch. Off, nothing new is learned and tasks read nothing. */
  enabled: boolean;
};

/**
 * What memory may do for one learner, from the same age protections `getLearnerProtections`
 * applies, so background work without a session follows the same rules as the screens.
 * Callers derive `userId` from the session or from a workflow a session started.
 */
export async function getMemoryAccess(userId: string): Promise<MemoryAccess> {
  const profile = await prisma.userLearningProfile.findUnique({
    select: { birthMonth: true, birthYear: true, memoryEnabled: true },
    where: { userId },
  });

  const ageGroup = getAgeGroup({
    birthMonth: profile?.birthMonth ?? null,
    birthYear: profile?.birthYear ?? null,
  });

  return {
    allowSensitive: ageGroup === "adult",
    categories: getProtectionsForAgeGroup(ageGroup).memoryCategories,
    enabled: profile?.memoryEnabled ?? true,
  };
}
