import { BuddyGlasses, type UserLearningProfile, prisma } from "@zoonk/db";
import { isKnownMinor } from "@zoonk/utils/age";
import { isUsageDataLockedOff } from "@zoonk/utils/usage-data";
import { getRequestInstant } from "../../learner/facts/request-instant";
import { DAILY_TIME_CHOICES } from "../../plans/daily-minutes";
import { findRequestCountry } from "../../users/request-country";
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
  country,
  now,
  profile,
}: {
  availableGlasses: BuddyGlasses[];
  country: string | null;
  now: Date;
  profile: UserLearningProfile | null;
}): LearningProfileView {
  const birthYear = profile?.birthYear ?? null;
  const minor = isKnownMinor({ birthYear, country, now });

  return {
    activeGoalId: profile?.activeGoalId ?? null,
    availableGlasses,
    birthYear,
    buddy: resolveProfileBuddy(profile),
    dailyLimitMinutes: profile?.dailyLimitMinutes ?? null,
    dailyTimes: DAILY_TIME_CHOICES,
    shareUsageData: profile?.shareUsageData ?? null,
    soundsEnabled: profile?.soundsEnabled ?? true,
    usageDataLockedOff: isUsageDataLockedOff({ country, minor }),
  };
}

/** GETs supply their request fact; write responses omit it for a fresh read. */
export async function findLearningProfileView(
  userId: string,
  knownProfile?: UserLearningProfile | null | Promise<UserLearningProfile | null>,
): Promise<LearningProfileView> {
  const [profile, availableGlasses, country, now] = await Promise.all([
    knownProfile === undefined
      ? prisma.userLearningProfile.findUnique({ where: { userId } })
      : knownProfile,
    listAvailableGlasses(userId),
    findRequestCountry(),
    getRequestInstant(),
  ]);

  return toLearningProfileView({ availableGlasses, country, now, profile });
}
