import "server-only";
import {
  getHiddenLessonKindsFromPreferences,
  getUpdatedLessonFilterSettings,
} from "@/lib/lessons/lesson-kind-filters";
import { getSession } from "@zoonk/core/users/session/get";
import { type LessonKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * The chapter lesson list reads hidden kinds from the learner profile so the
 * same filters follow the signed-in learner across devices and browser sessions.
 */
export async function getUserHiddenLessonKinds(headers?: Headers): Promise<LessonKind[]> {
  const session = await getSession(headers);

  if (!session) {
    return [];
  }

  const { data, error } = await safeAsync(() =>
    prisma.userLearningProfile.findUnique({ where: { userId: session.user.id } }),
  );

  if (error) {
    logError("Error loading hidden lesson kinds:", error);
    return [];
  }

  return getHiddenLessonKindsFromPreferences(data?.preferences);
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

  const { data: profile, error: loadError } = await safeAsync(() =>
    prisma.userLearningProfile.findUnique({ where: { userId: session.user.id } }),
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
      create: { preferences, userId: session.user.id },
      update: { preferences },
      where: { userId: session.user.id },
    }),
  );

  return { error, saved: !error };
}
