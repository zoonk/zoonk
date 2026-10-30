import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { loadLessonPlanSkillIds } from "../../learner/_utils/lesson-plan-skills";
import { applyAnswerToLearnerSkill } from "../../learner/_utils/update-learner-skill";
import { gradeLessonAnswers } from "../../learner/answer-rating";
import { NEW_SKILL_MEMORY, reviewSkillMemory } from "../../learner/fsrs-scheduler";
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
async function reviewLessonPlanSkills({
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

/** Returns an ISO instant, or null without a scheduled review. */
export async function getNextReviewAt({
  skillIds,
  transaction = prisma,
  userId,
}: {
  skillIds: readonly string[];
  transaction?: TransactionClient;
  userId: string;
}): Promise<string | null> {
  if (skillIds.length === 0) {
    return null;
  }

  const next = await transaction.learnerSkill.findFirst({
    orderBy: { due: "asc" },
    select: { due: true },
    where: { due: { not: null }, skillId: { in: [...skillIds] }, userId },
  });

  return next?.due?.toISOString() ?? null;
}

/** An empty skillIds announcement, as for quick explanations, reviews nothing. */
export async function reviewFinishedLesson({
  answers,
  planSkillIds,
  reviewedAt,
  skillIds,
  timeZone,
  transaction,
  userId,
}: {
  answers: readonly RunAnswer[];
  planSkillIds: readonly string[];
  reviewedAt: Date;
  skillIds: readonly string[];
  timeZone: string;
  transaction: TransactionClient;
  userId: string;
}): Promise<{ changed: boolean; nextReviewAt: string | null }> {
  const changed =
    skillIds.length > 0
      ? await reviewLessonPlanSkills({
          answers,
          planSkillIds,
          reviewedAt,
          timeZone,
          transaction,
          userId,
        })
      : false;

  const nextReviewAt = await getNextReviewAt({ skillIds, transaction, userId });
  return { changed, nextReviewAt };
}

/** Projects completion's earliest plan-skill review, falling back to ownDue when no plan holds the lesson. */
export async function getScreenComesBack({
  lessonId,
  ownDue,
  runStartedAt,
  timeZone,
  userId,
}: {
  lessonId: string;
  ownDue: Date | null;
  runStartedAt: Date;
  timeZone: string;
  userId: string;
}): Promise<Date | null> {
  const held = await loadLessonPlanSkillIds({ lessonIds: [lessonId], userId });
  const planSkillIds = held.get(lessonId) ?? [];

  if (planSkillIds.length === 0) {
    return ownDue;
  }

  const [answers, memories] = await Promise.all([
    prisma.attempt.findMany({
      orderBy: { answeredAt: "asc" },
      select: { isCorrect: true, skillId: true, stepId: true },
      where: { answeredAt: { gte: runStartedAt }, step: { lessonId }, userId },
    }),
    prisma.learnerSkill.findMany({ where: { skillId: { in: planSkillIds }, userId } }),
  ]);

  const grade = gradeLessonAnswers(toFirstAnswers(answers));
  const toReview = new Set(getSkillsToReview({ answers, planSkillIds }));
  const now = new Date();

  const dues = planSkillIds.map((skillId) => {
    const memory = memories.find((row) => row.skillId === skillId) ?? NEW_SKILL_MEMORY;

    return toReview.has(skillId) && grade
      ? reviewSkillMemory({ answer: grade, learning: true, memory, reviewedAt: now, timeZone }).due
      : memory.due;
  });

  const times = dues.flatMap((due) => (due ? [due.getTime()] : []));

  return times.length > 0 ? new Date(Math.min(...times)) : null;
}
