import { BuddyGlasses, type UserLearningProfile, prisma } from "@zoonk/db";
import { DEFAULT_BUDDY, resolveProfileBuddy } from "../default-buddy";
import { type LearningProfileView } from "../learning-profile-contract";

const STARTER_GLASSES = DEFAULT_BUDDY.glasses;

/** Round comes with every buddy; other frames are earned as glasses milestones keyed by the frame. */
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

/** A learner without a saved choice gets the default buddy. */
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

export async function findLearningProfileView(userId: string): Promise<LearningProfileView> {
  const [profile, availableGlasses] = await Promise.all([
    prisma.userLearningProfile.findUnique({ where: { userId } }),
    listAvailableGlasses(userId),
  ]);

  return toLearningProfileView({ availableGlasses, profile });
}
