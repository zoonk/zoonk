import "server-only";
import { type BuddyGlasses, prisma } from "@zoonk/db";
import { isKnownMinor } from "@zoonk/utils/age";
import { isUsageDataLockedOff } from "@zoonk/utils/usage-data";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getLearningProfileCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getSession } from "../users/get-session";
import { findRequestCountry } from "../users/request-country";
import { findLearningProfileView, listAvailableGlasses } from "./_utils/learning-profile-view";
import { DEFAULT_BUDDY } from "./default-buddy";
import {
  type LearningProfileUpdateInput,
  type LearningProfileView,
} from "./learning-profile-contract";

export type LearningProfileUpdateResult =
  | { profile: LearningProfileView; status: "updated" }
  | { status: "glassesNotEarned" | "goalNotFound" | "unauthorized" };

function getBuddyData(buddy: LearningProfileUpdateInput["buddy"]) {
  if (buddy === undefined) {
    return {};
  }

  if (buddy === null) {
    return { buddyGlasses: DEFAULT_BUDDY.glasses, buddyKind: null, buddyName: null };
  }

  return {
    buddyGlasses: buddy.glasses ?? DEFAULT_BUDDY.glasses,
    buddyKind: buddy.kind,
    buddyName: buddy.name ?? null,
  };
}

function getProfileData({
  input,
  shareUsageData,
}: {
  input: LearningProfileUpdateInput;
  shareUsageData: boolean | null | undefined;
}) {
  return {
    ...(input.activeGoalId !== undefined && { activeGoalId: input.activeGoalId }),
    ...(input.soundsEnabled !== undefined && { soundsEnabled: input.soundsEnabled }),
    ...(shareUsageData !== undefined && { shareUsageData }),
    ...(input.dailyLimitMinutes !== undefined && { dailyLimitMinutes: input.dailyLimitMinutes }),
    ...getBuddyData(input.buddy),
  };
}

type ProfileData = ReturnType<typeof getProfileData>;

/** Showing unsaved defaults must not create rows or change plan inputs. */
const UNSAVED_PROFILE = {
  activeGoalId: null,
  buddyGlasses: DEFAULT_BUDDY.glasses,
  buddyKind: null,
  buddyName: null,
  dailyLimitMinutes: null,
  shareUsageData: null,
  soundsEnabled: true,
} satisfies { [Field in keyof ProfileData]-?: ProfileData[Field] | null };

async function writeProfile({ data, userId }: { data: ProfileData; userId: string }) {
  return writeLearnerChange({ userId }, async (tx) => {
    const current =
      (await tx.userLearningProfile.findUnique({ where: { userId } })) ?? UNSAVED_PROFILE;

    const changed = Object.entries(data).some(([key, value]) =>
      Object.entries(current).some(([field, saved]) => field === key && value !== saved),
    );

    if (!changed) {
      return unchanged(false);
    }

    await tx.userLearningProfile.upsert({
      create: { ...data, userId },
      update: data,
      where: { userId },
    });

    return true;
  });
}

async function hasEarnedGlasses({ glasses, userId }: { glasses: BuddyGlasses; userId: string }) {
  const available = await listAvailableGlasses(userId);
  return available.includes(glasses);
}

async function isSelectableGoal({ goalId, userId }: { goalId: string; userId: string }) {
  const goal = await prisma.goal.findFirst({
    select: { id: true },
    where: { id: goalId, status: { not: "archived" }, userId },
  });

  return goal !== null;
}

async function findInvalidField({
  input,
  userId,
}: {
  input: LearningProfileUpdateInput;
  userId: string;
}): Promise<"glassesNotEarned" | "goalNotFound" | null> {
  const glasses = input.buddy?.glasses;
  const goalId = input.activeGoalId;

  const [glassesAllowed, goalAllowed] = await Promise.all([
    glasses ? hasEarnedGlasses({ glasses, userId }) : true,
    goalId ? isSelectableGoal({ goalId, userId }) : true,
  ]);

  if (!glassesAllowed) {
    return "glassesNotEarned";
  }

  return goalAllowed ? null : "goalNotFound";
}

/**
 * A minor's yes where the law needs one isn't theirs to give, so it's kept as no choice and they're
 * asked again once they're an adult.
 */
async function findShareUsageData({
  share,
  userId,
}: {
  share: boolean | undefined;
  userId: string;
}): Promise<boolean | null | undefined> {
  if (share !== true) {
    return share;
  }

  const [profile, country] = await Promise.all([
    prisma.userLearningProfile.findUnique({ select: { birthYear: true }, where: { userId } }),
    findRequestCountry(),
  ]);

  const minor = isKnownMinor({ birthYear: profile?.birthYear ?? null, country, now: new Date() });
  return isUsageDataLockedOff({ country, minor }) ? null : share;
}

export async function updateLearningProfile(
  input: LearningProfileUpdateInput,
): Promise<LearningProfileUpdateResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const [invalidField, shareUsageData] = await Promise.all([
    findInvalidField({ input, userId }),
    findShareUsageData({ share: input.shareUsageData, userId }),
  ]);

  if (invalidField) {
    return { status: invalidField };
  }

  const data = getProfileData({ input, shareUsageData });

  const changed = await writeProfile({ data, userId });

  if (changed) {
    revalidateCacheTags([getLearningProfileCacheTag(userId)]);
  }

  return { profile: await findLearningProfileView(userId), status: "updated" };
}
