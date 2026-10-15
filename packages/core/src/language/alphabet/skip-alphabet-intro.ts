import "server-only";
import { isJsonObject } from "@zoonk/utils/json";
import { usesNonLatinScript } from "@zoonk/utils/languages";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../cache/tags";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
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

  const result = await writeLearnerChange<SkipAlphabetIntroResult>(
    { planInputs: true, userId },
    async (tx) => {
      const admitted = await tx.goal.findFirst({ where: { id: goal.id, userId } });

      if (!admitted) {
        return unchanged({ status: "notFound" } as const);
      }

      const lesson = admitted.targetLanguage
        ? await tx.lesson.findUnique({
            select: { id: true },
            where: {
              languageIdentity: {
                identityKey: getAlphabetIdentityKey(admitted.targetLanguage),
                language: admitted.language,
              },
            },
          })
        : null;

      /** Queue changes lock blocks before goals, in id order, after plans and the learner. */
      const blocks = lesson
        ? await tx.$queryRaw<{ id: string }[]>`
          SELECT block.id FROM study_session_blocks AS block
          JOIN study_sessions AS session ON session.id = block.session_id
          WHERE block.lesson_id = ${lesson.id}::uuid AND block.status = 'pending'
            AND session.goal_id = ${goal.id}::uuid AND session.user_id = ${userId}::uuid
          ORDER BY block.id FOR UPDATE OF block
        `
        : [];

      await tx.$queryRaw`
      SELECT id FROM goals WHERE id = ${goal.id}::uuid AND user_id = ${userId}::uuid FOR UPDATE
    `;

      const current = await tx.goal.findFirst({ where: { id: goal.id, userId } });

      if (!current) {
        return unchanged({ status: "notFound" } as const);
      }

      if (
        current.kind !== "language" ||
        !current.targetLanguage ||
        !usesNonLatinScript(current.targetLanguage)
      ) {
        return unchanged({ status: "notLanguage" } as const);
      }

      const details = isJsonObject(current.details) ? current.details : {};

      if (details[ALPHABET_INTRO_DETAIL] === "skipped") {
        return unchanged({ status: "skipped" } as const);
      }

      if (lesson) {
        await tx.studySessionBlock.updateMany({
          data: { status: "skipped" },
          where: {
            id: { in: blocks.map((block) => block.id) },
            lessonId: lesson.id,
            session: { goalId: goal.id, userId },
            status: "pending",
          },
        });
      }

      await tx.goal.update({
        data: { details: { ...details, [ALPHABET_INTRO_DETAIL]: "skipped" } },
        where: { id: goal.id },
      });

      return { status: "skipped" } as const;
    },
  );

  revalidateCacheTags([getGoalsCacheTag(userId)]);

  return result;
}
