import { MIN_BLOCK_MINUTES, toMinutes } from "../block-minutes";
import { toBlockPayload } from "../block-payload";
import { isFullReviewDay } from "../full-review";
import { type PlannedBlock, type PlannedLesson, type SessionBuildInput } from "../session-builder";
import { keepDuelLessons } from "./lessons-before-challenges";

export function canAddSessionLessons({
  reviewDay,
  trialEnded,
}: {
  reviewDay: boolean;
  trialEnded: boolean;
}): boolean {
  return !reviewDay && !trialEnded;
}

export function toLessonBlock(lesson: PlannedLesson, reinforcement: boolean): PlannedBlock {
  return {
    canDo: lesson.canDo,
    estimatedMinutes: toMinutes(lesson.minutes),
    kind: "learn",
    lessonId: lesson.lessonId,
    payload: toBlockPayload({
      chapterId: lesson.chapterId,
      planItemId: lesson.planItemId,
      planItemKey: lesson.planItemKey ?? null,
      planSkillId: lesson.planSkillId,
      reinforcement,
      skillIds: lesson.skillIds,
      title: lesson.title,
    }),
  };
}

/** The first lesson may overflow the soft budget. */
export function takeLessons({
  budget,
  lessons,
  overflow = true,
}: {
  overflow?: boolean;
  budget: number;
  lessons: readonly PlannedLesson[];
}): PlannedLesson[] {
  const fitting = lessons.filter(
    (_, index) =>
      lessons.slice(0, index + 1).reduce((sum, lesson) => sum + lesson.minutes, 0) <= budget,
  );

  const first = lessons[0];
  const offerNext = overflow && fitting.length === 0 && first && budget >= MIN_BLOCK_MINUTES;

  return offerNext ? [first] : fitting;
}

export function getLessonMinutes(lessons: readonly PlannedLesson[]): number {
  return lessons.reduce((sum, lesson) => sum + toMinutes(lesson.minutes), 0);
}

export function isSessionReviewDay(input: SessionBuildInput): boolean {
  return Boolean(input.reviewPlanItemId || input.reviewPlanItemKey) || isFullReviewDay(input);
}

/** Review days and expired free trials offer no new lessons; duel days retain only their planned surrounding lessons. */
export function getNewLessons(input: SessionBuildInput): readonly PlannedLesson[] {
  return canAddSessionLessons({
    reviewDay: isSessionReviewDay(input),
    trialEnded: input.examTrialEnded,
  })
    ? keepDuelLessons(input)
    : [];
}
