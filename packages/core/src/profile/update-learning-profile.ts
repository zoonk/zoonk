import "server-only";
import { type BuddyGlasses, type UserLearningProfile, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getLearningProfileCacheTag } from "../cache/tags";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
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

/** Roll back provisional marks when admission discovers a no-op or needs different plan locks. */
class ProfileAdmissionError extends Error {
  override name = "ProfileAdmissionError";

  readonly reason: "unchanged" | "retry";

  constructor(reason: "unchanged" | "retry") {
    super(`Profile admission requires ${reason === "unchanged" ? "no write" : "another attempt"}`);
    this.reason = reason;
  }
}

const MAX_PROFILE_ATTEMPTS = 3;

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

type ProfileData = ReturnType<typeof getProfileData>;

/** Unsaved defaults are a view, not a reason to create a row or change a revision. */
const UNSAVED_PROFILE = {
  activeGoalId: null,
  buddyGlasses: DEFAULT_BUDDY.glasses,
  buddyKind: null,
  buddyName: null,
  dailyLimitMinutes: null,
  soundsEnabled: true,
} satisfies Required<ProfileData>;

function getProfileChange({
  data,
  profile,
}: {
  data: ProfileData;
  profile: UserLearningProfile | null;
}) {
  const current = profile ?? UNSAVED_PROFILE;

  const planInputs =
    (data.activeGoalId !== undefined && data.activeGoalId !== current.activeGoalId) ||
    (data.dailyLimitMinutes !== undefined && data.dailyLimitMinutes !== current.dailyLimitMinutes);

  return {
    changed:
      planInputs ||
      (data.soundsEnabled !== undefined && data.soundsEnabled !== current.soundsEnabled) ||
      (data.buddyKind !== undefined && data.buddyKind !== current.buddyKind) ||
      (data.buddyName !== undefined && data.buddyName !== current.buddyName) ||
      (data.buddyGlasses !== undefined && data.buddyGlasses !== current.buddyGlasses),
    planInputs,
  };
}

async function writeProfileAttempt({ data, userId }: { data: ProfileData; userId: string }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.userLearningProfile.findUnique({ where: { userId } });
    const initial = getProfileChange({ data, profile: existing });

    if (!initial.changed) {
      return false;
    }

    await markLearnerChanged(tx, { planInputs: initial.planInputs, userId });

    const admitted = await tx.userLearningProfile.findUnique({ where: { userId } });
    const current = getProfileChange({ data, profile: admitted });

    if (!current.changed) {
      throw new ProfileAdmissionError("unchanged");
    }

    if (initial.planInputs !== current.planInputs) {
      /** Never acquire plan locks after the learner row or retain unnecessary plan bumps. */
      throw new ProfileAdmissionError("retry");
    }

    await tx.userLearningProfile.upsert({
      create: { ...data, userId },
      update: data,
      where: { userId },
    });

    return true;
  });
}

async function writeProfile({
  attempt = 1,
  data,
  userId,
}: {
  attempt?: number;
  data: ProfileData;
  userId: string;
}): Promise<boolean> {
  const { data: changed, error } = await safeAsync(() => writeProfileAttempt({ data, userId }));

  if (error instanceof ProfileAdmissionError && error.reason === "unchanged") {
    return false;
  }

  if (error instanceof ProfileAdmissionError && attempt < MAX_PROFILE_ATTEMPTS) {
    return writeProfile({ attempt: attempt + 1, data, userId });
  }

  if (error) {
    throw error;
  }

  return changed;
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

  const changed = await writeProfile({ data, userId });

  if (changed) {
    revalidateCacheTags([getLearningProfileCacheTag(userId)]);
  }

  return { profile: await findLearningProfileView(userId), status: "updated" };
}
