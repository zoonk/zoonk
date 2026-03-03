import "server-only";
import { prisma } from "@zoonk/db";
import { shuffle } from "@zoonk/utils/shuffle";

const REVIEW_TARGET_COUNT = 10;

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
  lessonId: number;
  userId: number | null;
}) {
  const lessonStepFilter = {
    activity: { kind: { not: "review" as const }, lessonId },
    isPublished: true,
    kind: { not: "static" as const },
  };

  if (!userId) {
    const allSteps = await prisma.step.findMany({
      include: { sentence: true, word: true },
      where: lessonStepFilter,
    });

    return shuffle(allSteps).slice(0, REVIEW_TARGET_COUNT);
  }

  // Simplified "never corrected" check: a step is a tier-1 mistake if it has
  // at least one incorrect attempt AND zero correct attempts. This avoids
  // complex timestamp comparisons while effectively capturing "user still
  // hasn't gotten this right."
  const [incorrectAttempts, correctAttempts] = await Promise.all([
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
  const allMistakeIds = incorrectAttempts.map((attempt) => attempt.stepId);

  // Tier 1: most recent attempt was incorrect (never corrected)
  const recentMistakes = allMistakeIds.filter((stepId) => !correctStepIds.has(stepId));

  // Tier 2: had an incorrect attempt but later corrected
  const fixedMistakes = allMistakeIds.filter((stepId) => correctStepIds.has(stepId));

  // Combine tiers, tier 1 first
  let selectedIds = [...recentMistakes, ...fixedMistakes];

  // If tier 1 alone is >= target, skip tier 2 and fillers
  if (recentMistakes.length >= REVIEW_TARGET_COUNT) {
    selectedIds = recentMistakes;
  }

  // Fill with random if needed
  if (selectedIds.length < REVIEW_TARGET_COUNT) {
    const fillerSteps = await prisma.step.findMany({
      select: { id: true },
      where: { ...lessonStepFilter, id: { notIn: selectedIds } },
    });

    const shuffledFillers = shuffle(fillerSteps).slice(0, REVIEW_TARGET_COUNT - selectedIds.length);
    selectedIds = [...selectedIds, ...shuffledFillers.map((step) => step.id)];
  }

  // Fetch full step data for the selected IDs
  const steps = await prisma.step.findMany({
    include: { sentence: true, word: true },
    where: { id: { in: selectedIds } },
  });

  return shuffle(steps);
}
