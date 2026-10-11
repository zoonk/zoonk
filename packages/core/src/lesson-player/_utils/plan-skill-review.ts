import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { loadLessonPlanSkillIds } from "../../learner/_utils/lesson-plan-skills";
import { applyAnswerToLearnerSkill } from "../../learner/_utils/update-learner-skill";
import { gradeLessonAnswers } from "../../learner/answer-rating";
import { NEW_SKILL_MEMORY, reviewSkillMemory } from "../../learner/fsrs-scheduler";

/** A recorded answer of the run, oldest first. */
type RunAnswer = { isCorrect: boolean; skillId: string | null; stepId: string | null };

/**
 * The run's first answer to each screen, as the lesson's tally counts it (`tallyLessonRun`): later
 * entries overwrite earlier ones, so reading the answers newest first keeps the first.
 */
function toFirstAnswers(answers: readonly RunAnswer[]): boolean[] {
  const screens = answers.flatMap((answer) =>
    answer.stepId ? [[answer.stepId, answer.isCorrect] as const] : [],
  );

  return [...new Map(screens.toReversed()).values()];
}

/**
 * The plan skills a run reviews as a whole when it's finished (see `reviewLessonPlanSkills`): the
 * ones the learner's plans hold its lesson for that none of its answers trained already.
 */
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

/**
 * A finished lesson the learner's plans hold for a plan skill its answers don't land on (its
 * screens teach finer skills of their own) counts as one review of that plan skill, graded from
 * the run's first answers (`gradeLessonAnswers`): reviews and practice ask the plan's skills, so
 * this is what brings the lesson back, on the schedule its end screen gives. One review per lesson,
 * never one per screen, so a long lesson doesn't read as many days of remembering.
 */
async function reviewLessonPlanSkills({
  answers,
  lessonId,
  reviewedAt,
  timeZone,
  userId,
}: {
  answers: readonly RunAnswer[];
  lessonId: string;
  reviewedAt: Date;
  timeZone: string;
  userId: string;
}): Promise<void> {
  const grade = gradeLessonAnswers(toFirstAnswers(answers));
  const planSkillIds = await loadLessonPlanSkillIds({ lessonIds: [lessonId], userId });
  const skillIds = getSkillsToReview({ answers, planSkillIds: planSkillIds.get(lessonId) ?? [] });

  if (!grade || skillIds.length === 0) {
    return;
  }

  await Promise.all(
    skillIds.map((skillId) =>
      applyAnswerToLearnerSkill({
        answer: grade,
        learning: true,
        reviewedAt,
        skillId,
        timeZone,
        userId,
      }),
    ),
  );

  revalidateCacheTags([getLearnerModelCacheTag(userId)]);
}

/** The earliest review of the lesson's skills, which the completion moment announces. */
export async function getNextReviewAt({
  skillIds,
  userId,
}: {
  skillIds: readonly string[];
  userId: string;
}): Promise<string | null> {
  if (skillIds.length === 0) {
    return null;
  }

  const next = await prisma.learnerSkill.findFirst({
    orderBy: { due: "asc" },
    select: { due: true },
    where: { due: { not: null }, skillId: { in: [...skillIds] }, userId },
  });

  return next?.due?.toISOString() ?? null;
}

/**
 * A run just finished: its review of the plan skills it counts for (`reviewLessonPlanSkills`), then
 * the earliest review of the lesson's skills the completion announces (`skillIds`, see
 * `loadLessonReviewSkillIds`). A lesson that announces none (a quick explanation) reviews nothing.
 */
export async function reviewFinishedLesson({
  answers,
  lessonId,
  skillIds,
  timeZone,
  userId,
}: {
  answers: readonly RunAnswer[];
  lessonId: string;
  skillIds: readonly string[];
  timeZone: string;
  userId: string;
}): Promise<string | null> {
  if (skillIds.length > 0) {
    await reviewLessonPlanSkills({ answers, lessonId, reviewedAt: new Date(), timeZone, userId });
  }

  return getNextReviewAt({ skillIds, userId });
}

/**
 * When a screen's idea comes back, said right after it's answered: the earliest review of the
 * plan skills the learner's plans hold its lesson for, as finishing the lesson with the run's
 * answers so far would schedule them (see `reviewLessonPlanSkills`), or the screen's own skill's
 * when no plan holds the lesson for one.
 */
export async function getScreenComesBack({
  lessonId,
  ownDue,
  runStartedAt,
  timeZone,
  userId,
}: {
  lessonId: string;
  /** When the skill the answer landed on comes back, now that it's recorded. */
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
