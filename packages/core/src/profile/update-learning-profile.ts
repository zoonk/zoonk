import "server-only";
import { type BuddyGlasses, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getLearningProfileCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getSession } from "../users/get-session";
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

function getProfileData(input: LearningProfileUpdateInput) {
  return {
    ...(input.activeGoalId !== undefined && { activeGoalId: input.activeGoalId }),
    ...(input.soundsEnabled !== undefined && { soundsEnabled: input.soundsEnabled }),
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
  soundsEnabled: true,
} satisfies Required<ProfileData>;

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

export async function updateLearningProfile(
  input: LearningProfileUpdateInput,
): Promise<LearningProfileUpdateResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const invalidField = await findInvalidField({ input, userId });

  if (invalidField) {
    return { status: invalidField };
  }

  const data = getProfileData(input);

  const changed = await writeProfile({ data, userId });

  if (changed) {
    revalidateCacheTags([getLearningProfileCacheTag(userId)]);
  }

  return { profile: await findLearningProfileView(userId), status: "updated" };
}
