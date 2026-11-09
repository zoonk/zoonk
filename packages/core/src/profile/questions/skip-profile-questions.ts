import "server-only";
import { type ProfileQuestion } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "../../cache/tags";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSession } from "../../users/get-session";
import { findOnboardingGoalIds } from "../../view-models/onboarding/_utils/onboarding-goals";
import { PROFILE_QUESTIONS, PROFILE_QUESTION_VERSIONS } from "./profile-question-contract";

export async function skipProfileQuestions({
  goalId,
  questions,
  forever = false,
}: {
  goalId: string;
  questions: ProfileQuestion[];
  forever?: boolean;
}): Promise<{ status: "saved" } | { status: "notFound" | "unauthorized" }> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(goalId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;

  const saved = await writeLearnerChange<{ status: "saved" | "notFound"; changed: boolean }>(
    { userId },
    async (tx) => {
      const goal = await tx.goal.findFirst({ where: { id: goalId, userId } });

      if (!goal) {
        return unchanged({ changed: false, status: "notFound" as const });
      }

      if (forever) {
        const answers = await tx.profileAnswer.findMany({ where: { userId } });

        const missing = PROFILE_QUESTIONS.filter(
          (question) => !answers.some((answer) => answer.question === question),
        );

        if (missing.length === 0) {
          return unchanged({ changed: false, status: "saved" as const });
        }

        await tx.profileAnswer.createMany({
          data: missing.map((question) => ({
            answeredAt: new Date(),
            outcome: "declined",
            question,
            userId,
            version: PROFILE_QUESTION_VERSIONS[question],
          })),
        });

        return { changed: true, status: "saved" as const };
      }

      const goalIds = await findOnboardingGoalIds(goal, tx);
      const goals = await tx.goal.findMany({ where: { id: { in: goalIds }, userId } });

      const changed = await Promise.all(
        goals.map(async (item) => {
          const details = isJsonObject(item.details) ? item.details : {};

          const answered = Array.isArray(details.answered)
            ? details.answered.filter((id): id is string => typeof id === "string")
            : [];

          const next = [...new Set([...answered, ...questions])];

          if (next.length === answered.length) {
            return false;
          }

          await tx.goal.update({
            data: { details: { ...details, answered: next } },
            where: { id: item.id },
          });

          return true;
        }),
      );

      if (!changed.some(Boolean)) {
        return unchanged({ changed: false, status: "saved" as const });
      }

      return { changed: true, status: "saved" as const };
    },
  );

  if (saved.changed) {
    revalidateCacheTags([getGoalsCacheTag(userId), getLearningProfileCacheTag(userId)]);
  }

  return { status: saved.status };
}
