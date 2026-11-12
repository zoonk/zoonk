import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { applyAnswerToLearnerSkill } from "../../learner/_utils/update-learner-skill";
import { gradeLessonAnswers } from "../../learner/answer-rating";
import { isAnswerableStep } from "../lesson-run";
import { type PlayableLibraryStep } from "../playable-lesson";
import { type loadPlayedLesson } from "./load-played-lesson";

/** Include answers from every unfinished sitting, not only the current run. */
export async function loadLessonAttempts({
  sittings,
  steps,
  userId,
}: {
  sittings: Awaited<ReturnType<typeof loadPlayedLesson>>["sittings"];
  steps: Pick<PlayableLibraryStep, "id" | "kind">[];
  userId: string;
}) {
  const answerable = steps.filter((step) => isAnswerableStep(step)).map((step) => step.id);

  return prisma.attempt.findMany({
    orderBy: { answeredAt: "asc" },
    select: {
      answeredAt: true,
      id: true,
      isCorrect: true,
      itemId: true,
      skillId: true,
      stepId: true,
    },
    where: { answeredAt: { gte: sittings[0]?.startedAt }, stepId: { in: answerable }, userId },
  });
}

/** Input answers are oldest first. */
type RunAnswer = { isCorrect: boolean; skillId: string | null; stepId: string | null };

function toFirstAnswers(answers: readonly RunAnswer[]): boolean[] {
  const screens = answers.flatMap((answer) =>
    answer.stepId ? [[answer.stepId, answer.isCorrect] as const] : [],
  );

  return [...new Map(screens.toReversed()).values()];
}

function getSkillsToReview({
  answers,
  planSkillIds,
}: {
  answers: readonly RunAnswer[];
  planSkillIds: readonly string[];
}): string[] {
  const trained = new Set(answers.map((answer) => answer.skillId));
  return planSkillIds.filter((skillId) => !trained.has(skillId));
}

/** Review a plan skill once per finished lesson, not per screen, so a long lesson cannot simulate multiple recall days. */
export async function reviewLessonPlanSkills({
  answers,
  planSkillIds,
  reviewedAt,
  timeZone,
  transaction,
  userId,
}: {
  answers: readonly RunAnswer[];
  planSkillIds: readonly string[];
  reviewedAt: Date;
  timeZone: string;
  transaction: TransactionClient;
  userId: string;
}): Promise<boolean> {
  const grade = gradeLessonAnswers(toFirstAnswers(answers));
  const skillIds = getSkillsToReview({ answers, planSkillIds });

  if (!grade || skillIds.length === 0) {
    return false;
  }

  for (const skillId of skillIds.toSorted()) {
    // oxlint-disable-next-line no-await-in-loop -- Keep a deterministic skill lock order after the run lock.
    await applyAnswerToLearnerSkill(
      { answer: grade, learning: true, reviewedAt, skillId, timeZone, userId },
      transaction,
    );
  }

  return true;
}
