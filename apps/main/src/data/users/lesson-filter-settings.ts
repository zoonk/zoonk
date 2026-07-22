import "server-only";
import { getSession } from "@/data/users/get-session";
import {
  getHiddenLessonKindsFromPreferences,
  getUpdatedLessonFilterSettings,
} from "@/lib/lessons/lesson-kind-filters";
import { type LessonKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cacheTag, updateTag } from "next/cache";

/** Gives one learner's persisted lesson visibility settings a dedicated tag. */
function getLessonFilterSettingsCacheTag(userId: string): string {
  return `lesson-filter-settings:${userId}`;
}

async function findUserHiddenLessonKinds(userId: string): Promise<LessonKind[]> {
  "use cache";

  cacheTag(getLessonFilterSettingsCacheTag(userId));

  const profile = await prisma.userLearningProfile.findUnique({ where: { userId } });
  return getHiddenLessonKindsFromPreferences(profile?.preferences);
}

/** Resolves lesson visibility for the authenticated learner. */
export async function getUserHiddenLessonKinds(): Promise<LessonKind[]> {
  const session = await getSession();
  return session ? findUserHiddenLessonKinds(session.user.id) : [];
}

/**
 * Updating lesson filters must preserve the rest of the learning-profile JSON
 * because future preferences can share this same durable user settings record.
 */
export async function updateUserHiddenLessonKinds({
  hiddenLessonKinds,
}: {
  hiddenLessonKinds: LessonKind[];
}) {
  const session = await getSession();

  if (!session) {
    return { error: null, saved: false };
  }

  const userId = session.user.id;

  const { data: profile, error: loadError } = await safeAsync(() =>
    prisma.userLearningProfile.findUnique({ where: { userId } }),
  );

  if (loadError) {
    return { error: loadError, saved: false };
  }

  const preferences = getUpdatedLessonFilterSettings({
    hiddenLessonKinds,
    preferences: profile?.preferences,
  });

  const { error } = await safeAsync(() =>
    prisma.userLearningProfile.upsert({
      create: { preferences, userId },
      update: { preferences },
      where: { userId },
    }),
  );

  if (!error) {
    updateTag(getLessonFilterSettingsCacheTag(userId));
  }

  return { error, saved: !error };
}
