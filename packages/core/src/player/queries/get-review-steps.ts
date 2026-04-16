import "server-only";
import { type ActivityKind, type StepKind, getPublishedStepWhere, prisma } from "@zoonk/db";
import { shuffle } from "@zoonk/utils/shuffle";

const REVIEW_TARGET_COUNT = 10;
const EXCLUDED_ACTIVITY_KINDS: ActivityKind[] = ["review"];
const NON_REVIEWABLE_STEP_KINDS: StepKind[] = ["investigation", "static", "story", "visual"];

function reviewableStepFilter(lessonId: string) {
  return getPublishedStepWhere({
    activityWhere: { kind: { notIn: EXCLUDED_ACTIVITY_KINDS } },
    lessonWhere: { id: lessonId },
    stepWhere: { kind: { notIn: NON_REVIEWABLE_STEP_KINDS } },
  });
}

/**
 * Assembles review steps based on a user's mistakes (incorrect StepAttempt records).
 *
 * Tier system:
 * - Tier 1 (high-priority): Steps where the user has at least one incorrect
 *   attempt AND zero correct attempts. These are steps the user still struggles with.
 * - Tier 2 (reinforcement): Steps where the user had an incorrect attempt but
 *   also has at least one correct attempt. Worth reinforcing even though "fixed."
 * - Filler: Random interactive steps from the lesson, filling up to REVIEW_TARGET_COUNT.
 *
 * If there's no userId, all steps are random fillers.
 */
export async function getReviewSteps({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string | null;
}) {
  const lessonStepFilter = reviewableStepFilter(lessonId);

  if (!userId) {
    const allSteps = await prisma.step.findMany({
      include: { sentence: true, word: true },
      where: lessonStepFilter,
    });

    return shuffle(allSteps).slice(0, REVIEW_TARGET_COUNT);
  }

  // Fetch all eligible steps and attempt data in a single parallel round trip.
  // Lesson step counts are small, so fetching all steps upfront is efficient
  // and avoids extra queries for prioritized/filler IDs.
  const [allSteps, incorrectAttempts, correctAttempts] = await Promise.all([
    prisma.step.findMany({
      include: { sentence: true, word: true },
      where: lessonStepFilter,
    }),
    prisma.stepAttempt.findMany({
      distinct: ["stepId"],
      orderBy: { answeredAt: "desc" },
      select: { stepId: true },
      where: { isCorrect: false, step: lessonStepFilter, userId },
    }),
    prisma.stepAttempt.findMany({
      distinct: ["stepId"],
      select: { stepId: true },
      where: { isCorrect: true, step: lessonStepFilter, userId },
    }),
  ]);

  const correctStepIds = new Set(correctAttempts.map((attempt) => attempt.stepId));
  const mistakeStepIds = incorrectAttempts.map((attempt) => attempt.stepId);

  // Tier 1: never corrected. Tier 2: had an incorrect attempt but later corrected.
  const recentMistakes = mistakeStepIds.filter((stepId) => !correctStepIds.has(stepId));
  const fixedMistakes = mistakeStepIds.filter((stepId) => correctStepIds.has(stepId));

  // When tier 1 alone meets the target, skip tier 2 and fillers
  const prioritizedIds =
    recentMistakes.length >= REVIEW_TARGET_COUNT
      ? recentMistakes
      : [...recentMistakes, ...fixedMistakes];

  const prioritizedIdSet = new Set(prioritizedIds);

  // Partition steps: prioritized first, then random fillers from the remainder
  const prioritizedSteps = allSteps.filter((step) => prioritizedIdSet.has(step.id));
  const fillerSteps = allSteps.filter((step) => !prioritizedIdSet.has(step.id));
  const fillerCount = Math.max(0, REVIEW_TARGET_COUNT - prioritizedSteps.length);

  return shuffle([...prioritizedSteps, ...shuffle(fillerSteps).slice(0, fillerCount)]);
}

/**
 * Fetches steps for validating a review activity submission.
 * Only returns steps that are eligible for review — excludes
 * steps from review activities and static steps.
 */
export async function getReviewValidationSteps(params: { lessonId: string; stepIds: string[] }) {
  return prisma.step.findMany({
    include: { sentence: true, word: true },
    where: { ...reviewableStepFilter(params.lessonId), id: { in: params.stepIds } },
  });
}
