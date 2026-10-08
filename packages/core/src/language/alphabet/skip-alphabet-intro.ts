import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { usesNonLatinScript } from "@zoonk/utils/languages";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../cache/tags";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { getAlphabetIdentityKey } from "../../library/language/alphabet/alphabet-identity";
import { ALPHABET_INTRO_DETAIL } from "../../library/language/alphabet/alphabet-intro";

export type SkipAlphabetIntroResult = {
  status: "notFound" | "notLanguage" | "skipped" | "unauthorized";
};

/**
 * The learner already reads the script: their sessions stop opening with the alphabet lesson,
 * starting with today's if it hasn't begun. The lesson stays open as practice. Skipping again
 * changes nothing.
 */
export async function skipAlphabetIntro(goalId: string): Promise<SkipAlphabetIntroResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return { status: owned.status };
  }

  const { goal, userId } = owned;

  if (
    goal.kind !== "language" ||
    !goal.targetLanguage ||
    !usesNonLatinScript(goal.targetLanguage)
  ) {
    return { status: "notLanguage" };
  }

  const details = isJsonObject(goal.details) ? goal.details : {};

  const lesson = await prisma.lesson.findUnique({
    select: { id: true },
    where: {
      languageIdentity: {
        identityKey: getAlphabetIdentityKey(goal.targetLanguage),
        language: goal.language,
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.goal.update({
      data: { details: { ...details, [ALPHABET_INTRO_DETAIL]: "skipped" } },
      where: { id: goal.id },
    });

    if (lesson) {
      await tx.studySessionBlock.updateMany({
        data: { status: "skipped" },
        where: { lessonId: lesson.id, session: { goalId: goal.id, userId }, status: "pending" },
      });
    }
  });

  revalidateCacheTags([getGoalsCacheTag(userId)]);

  return { status: "skipped" };
}
