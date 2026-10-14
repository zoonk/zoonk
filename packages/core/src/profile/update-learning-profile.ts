import "server-only";
import { type BuddyGlasses, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getLearningProfileCacheTag } from "../cache/tags";
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

/** A buddy is set as a whole: its kind, an optional name and glasses (round unless earned ones). */
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

async function hasEarnedGlasses({ glasses, userId }: { glasses: BuddyGlasses; userId: string }) {
  const available = await listAvailableGlasses(userId);
  return available.includes(glasses);
}

/** Learners can switch to any of their goals that isn't archived. */
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

/** Saves what a screen changed on the learner's profile. */
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

  await prisma.userLearningProfile.upsert({
    create: { ...data, userId },
    update: data,
    where: { userId },
  });

  revalidateCacheTags([getLearningProfileCacheTag(userId)]);

  return { profile: await findLearningProfileView(userId), status: "updated" };
}
