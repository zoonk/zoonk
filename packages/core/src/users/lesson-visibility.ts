import "server-only";
import { type LessonKind, prisma } from "@zoonk/db";
import { cacheTag, revalidateTag } from "next/cache";
import { getLessonVisibilityCacheTag } from "../cache/tags";
import {
  getHiddenLessonKindsFromPreferences,
  getUpdatedLessonFilterSettings,
} from "../lessons/lesson-visibility";
import { getSession } from "./get-session";

type LessonVisibilityOptions = { requireAuthentication: true };

/**
 * Reads the durable visibility resource for a trusted session-derived user ID.
 */
async function findLessonVisibility(userId: string) {
  const profile = await prisma.userLearningProfile.findUnique({ where: { userId } });

  return { hiddenLessonKinds: getHiddenLessonKindsFromPreferences(profile?.preferences) };
}

/**
 * Returns the authenticated learner's canonical lesson visibility settings.
 * Guests receive the product's visible-by-default resource.
 */
export function getLessonVisibility(): Promise<{ hiddenLessonKinds: LessonKind[] }>;
export function getLessonVisibility(
  options: LessonVisibilityOptions,
): Promise<{ hiddenLessonKinds: LessonKind[] } | null>;

export async function getLessonVisibility(options?: LessonVisibilityOptions) {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return options?.requireAuthentication ? null : { hiddenLessonKinds: [] as LessonKind[] };
  }

  cacheTag(getLessonVisibilityCacheTag(session.user.id));
  return findLessonVisibility(session.user.id);
}

/**
 * Replaces the authenticated learner's hidden lesson kinds while preserving
 * unrelated JSON preferences, then immediately expires the private visibility
 * resource so every delivery adapter observes the write.
 */
export async function updateLessonVisibility({
  hiddenLessonKinds,
}: {
  hiddenLessonKinds: LessonKind[];
}) {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;
  const profile = await prisma.userLearningProfile.findUnique({ where: { userId } });

  const preferences = getUpdatedLessonFilterSettings({
    hiddenLessonKinds,
    preferences: profile?.preferences,
  });

  await prisma.userLearningProfile.upsert({
    create: { preferences, userId },
    update: { preferences },
    where: { userId },
  });

  revalidateTag(getLessonVisibilityCacheTag(userId), { expire: 0 });

  return { hiddenLessonKinds: getHiddenLessonKindsFromPreferences(preferences) };
}
