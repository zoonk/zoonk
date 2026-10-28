import { BuddyGlasses, type UserLearningProfile, prisma } from "@zoonk/db";
import { DEFAULT_BUDDY, resolveProfileBuddy } from "../default-buddy";
import { type LearningProfileView } from "../learning-profile-contract";

const STARTER_GLASSES = DEFAULT_BUDDY.glasses;

/** Round glasses are always available; other frames require their matching milestone. */
export async function listAvailableGlasses(userId: string): Promise<BuddyGlasses[]> {
  const milestones = await prisma.milestone.findMany({
    select: { key: true },
    where: { kind: "glasses", userId },
  });

  const earned = new Set(milestones.map((milestone) => milestone.key));

  return Object.values(BuddyGlasses).filter(
    (glasses) => glasses === STARTER_GLASSES || earned.has(glasses),
  );
}

function toLearningProfileView({
  availableGlasses,
  profile,
}: {
  availableGlasses: BuddyGlasses[];
  profile: UserLearningProfile | null;
}): LearningProfileView {
  return {
    activeGoalId: profile?.activeGoalId ?? null,
    availableGlasses,
    buddy: resolveProfileBuddy(profile),
    dailyLimitMinutes: profile?.dailyLimitMinutes ?? null,
    soundsEnabled: profile?.soundsEnabled ?? true,
  };
}

/** GETs supply their request fact; write responses omit it for a fresh read. */
export async function findLearningProfileView(
  userId: string,
  knownProfile?: UserLearningProfile | null | Promise<UserLearningProfile | null>,
): Promise<LearningProfileView> {
  const [profile, availableGlasses] = await Promise.all([
    knownProfile === undefined
      ? prisma.userLearningProfile.findUnique({ where: { userId } })
      : knownProfile,
    listAvailableGlasses(userId),
  ]);

  return toLearningProfileView({ availableGlasses, profile });
}
