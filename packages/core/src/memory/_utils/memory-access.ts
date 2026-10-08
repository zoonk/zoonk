import "server-only";
import { type MemoryCategory, prisma } from "@zoonk/db";
import { getAgeGroup } from "@zoonk/utils/age";
import { getProtectionsForAgeGroup } from "../../minors/age-protections";

export type MemoryAccess = {
  /** Whether sensitive facts may ever be kept, when the learner explicitly asks. Adults only. */
  allowSensitive: boolean;
  /** The categories this learner's memory may hold: only goals and learning for minors. */
  categories: MemoryCategory[];
  /** The learner turned memory on or off themselves; until then their age decides. */
  chosen: boolean;
  /** Whether memory is on: nothing new is learned and tasks read nothing while it's off. */
  enabled: boolean;
  /** A guardian turned memory off, so the learner can't turn it on while that link is active. */
  offByGuardian: boolean;
};

/**
 * What memory may do for one learner, from the same age protections `getLearnerProtections`
 * applies, so background work without a session follows the same rules as the screens. Memory is
 * the learner's own switch, which starts on only for adults, unless a guardian turned it off.
 * Callers derive `userId` from the session or from a workflow a session started.
 */
export async function getMemoryAccess(userId: string): Promise<MemoryAccess> {
  const [profile, guardianOff] = await Promise.all([
    prisma.userLearningProfile.findUnique({
      select: { birthMonth: true, birthYear: true, memoryEnabled: true },
      where: { userId },
    }),
    prisma.guardianLink.findFirst({
      select: { id: true },
      where: { memoryOff: true, status: "active", userId },
    }),
  ]);

  const ageGroup = getAgeGroup({
    birthMonth: profile?.birthMonth ?? null,
    birthYear: profile?.birthYear ?? null,
  });

  const protections = getProtectionsForAgeGroup(ageGroup);
  const offByGuardian = guardianOff !== null;

  return {
    allowSensitive: ageGroup === "adult",
    categories: protections.memoryCategories,
    chosen: typeof profile?.memoryEnabled === "boolean",
    enabled: !offByGuardian && (profile?.memoryEnabled ?? protections.memoryOnByDefault),
    offByGuardian,
  };
}

/**
 * Whether onboarding asks the learner to turn memory on: it starts off for their age (under 18 or
 * unknown), they haven't chosen yet, and no guardian keeps it off, where a yes would change nothing.
 */
export function asksToTurnOnMemory(access: MemoryAccess): boolean {
  return !access.chosen && !access.enabled && !access.offByGuardian;
}
