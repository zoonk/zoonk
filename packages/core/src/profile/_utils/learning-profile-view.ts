import { BuddyGlasses, type UserLearningProfile, prisma } from "@zoonk/db";
import { getAgeGroup } from "@zoonk/utils/age";
import { type LearningProfileView } from "../learning-profile-contract";

const STARTER_GLASSES = BuddyGlasses.round;

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

function getBirth(profile: UserLearningProfile | null) {
  if (!profile || profile.birthMonth === null || profile.birthYear === null) {
    return null;
  }

  return { month: profile.birthMonth, year: profile.birthYear };
}

/** A learner without a saved profile has no buddy or age yet. */
function toLearningProfileView({
  availableGlasses,
  profile,
}: {
  availableGlasses: BuddyGlasses[];
  profile: UserLearningProfile | null;
}): LearningProfileView {
  const birth = getBirth(profile);

  return {
    activeGoalId: profile?.activeGoalId ?? null,
    ageGroup: getAgeGroup({ birthMonth: birth?.month ?? null, birthYear: birth?.year ?? null }),
    availableGlasses,
    birth,
    buddy: profile?.buddyKind
      ? { glasses: profile.buddyGlasses, kind: profile.buddyKind, name: profile.buddyName }
      : null,
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
