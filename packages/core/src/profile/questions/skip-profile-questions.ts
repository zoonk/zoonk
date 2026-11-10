import "server-only";
import { type ProfileQuestion } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { isUuid } from "@zoonk/utils/uuid";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { trackOnboardingProgress } from "../../analytics/track-onboarding-progress";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "../../cache/tags";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSession } from "../../users/get-session";
import { findOnboardingGoalIds } from "../../view-models/onboarding/_utils/onboarding-goals";
import { toProfileQuestionSavedEvent } from "./_utils/profile-question-event";
import {
  PROFILE_QUESTIONS,
  PROFILE_QUESTION_VERSIONS,
  getProfileSteps,
} from "./profile-question-contract";

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

  const saved = await writeLearnerChange<{
    status: "saved" | "notFound";
    changed: boolean;
    skipped: ProfileQuestion[];
  }>({ userId }, async (tx) => {
    const goal = await tx.goal.findFirst({ where: { id: goalId, userId } });

    if (!goal) {
      return unchanged({ changed: false, skipped: [], status: "notFound" as const });
    }

    if (forever) {
      const answers = await tx.profileAnswer.findMany({ where: { userId } });

      const missing = PROFILE_QUESTIONS.filter(
        (question) => !answers.some((answer) => answer.question === question),
      );

      if (missing.length === 0) {
        return unchanged({ changed: false, skipped: [], status: "saved" as const });
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

      return { changed: true, skipped: missing, status: "saved" as const };
    }

    const goalIds = await findOnboardingGoalIds(goal, tx);
    const goals = await tx.goal.findMany({ where: { id: { in: goalIds }, userId } });

    const [answers, profile] = await Promise.all([
      tx.profileAnswer.findMany({ select: { question: true, version: true }, where: { userId } }),
      tx.userLearningProfile.findUnique({ select: { memoryEnabled: true }, where: { userId } }),
    ]);

    const skipped = getProfileSteps({
      answered: Object.fromEntries(answers.map((answer) => [answer.question, answer.version])),
      goal,
      memoryEnabled: profile?.memoryEnabled ?? true,
    }).filter((question) => questions.includes(question));

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
      return unchanged({ changed: false, skipped: [], status: "saved" as const });
    }

    return { changed: true, skipped, status: "saved" as const };
  });

  if (saved.changed) {
    revalidateCacheTags([getGoalsCacheTag(userId), getLearningProfileCacheTag(userId)]);
  }

  if (saved.skipped.length > 0) {
    const bulk = forever || questions.length !== 1;

    after(() =>
      trackLearnerEvents({
        events: bulk
          ? [{ name: "Profile Questions Skipped", properties: { remaining: saved.skipped.length } }]
          : saved.skipped.map((question) =>
              toProfileQuestionSavedEvent({
                from: "onboarding",
                input: { answer: null, question },
              }),
            ),
        goalId,
        userId,
      }),
    );

    if (!bulk) {
      trackOnboardingProgress({
        at: Date.now(),
        goalId,
        question: saved.skipped[0],
        stage: "question_answered",
      });
    }
  }

  return { status: saved.status };
}
