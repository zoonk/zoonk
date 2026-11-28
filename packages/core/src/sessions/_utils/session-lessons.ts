import { MIN_BLOCK_MINUTES, PRACTICE_MINUTES_PER_QUESTION, toMinutes } from "../block-minutes";
import { toBlockPayload } from "../block-payload";
import { getSessionDayMinutes } from "../fresh-start";
import { isFullReviewDay } from "../full-review";
import { type PlannedBlock, type PlannedLesson, type SessionBuildInput } from "../session-builder";

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

export function reserveCourseOpeningLesson(day: SessionBuildInput) {
  const opening =
    day.courseOpeningLessonId &&
    !day.usedMinutes &&
    !isSessionReviewDay(day) &&
    !day.mockReplacesDay &&
    getSessionDayMinutes(day) > 0
      ? [...day.lessons, ...(day.fillLessons ?? [])].find(
          (lesson) => lesson.lessonId === day.courseOpeningLessonId,
        )
      : null;

  if (!opening) {
    return null;
  }

  const block = toLessonBlock(opening, false);

  const remaining = {
    ...day,
    fillLessons: day.fillLessons?.filter((lesson) => lesson.lessonId !== opening.lessonId),
    lessons: day.lessons.filter((lesson) => lesson.lessonId !== opening.lessonId),
    planItems: day.planItems?.filter(
      (item) => (item.id ?? item.key) !== (opening.planItemId ?? opening.planItemKey),
    ),
    remedial: day.remedial && {
      ...day.remedial,
      teaching: day.remedial.teaching.filter(
        (option) => !("lessonId" in option) || option.lessonId !== opening.lessonId,
      ),
    },
    usedMinutes: block.estimatedMinutes,
  };

  return { block, remaining };
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

export function getNewLessons(input: SessionBuildInput): readonly PlannedLesson[] {
  return canAddSessionLessons(input) ? input.lessons : [];
}

export function canAddSessionLessons(input: SessionBuildInput): boolean {
  return (
    !isSessionReviewDay(input) || (input.allowsReviewLessons === true && !isFullReviewDay(input))
  );
}

function getReviewLessonMinutes({
  input,
  writingMinutes,
}: {
  input: SessionBuildInput;
  writingMinutes: number;
}): number {
  return input.allowsReviewLessons && canAddSessionLessons(input)
    ? getLessonMinutes(input.lessons) + writingMinutes
    : 0;
}

/** Preserve the opened day's practice share; unused question capacity returns time to lessons. */
export function getPracticeMinutes({
  budget,
  input,
  remaining,
  writingMinutes,
}: {
  budget: number;
  input: SessionBuildInput;
  remaining: number;
  writingMinutes: number;
}): number {
  const share = isSessionReviewDay(input) ? 1 : input.practiceShare;
  const practice = input.practice;
  const opened = input.openedPractice;

  // Multiplied before dividing, so a day that keeps its minutes gets its practice's exactly.
  const target = opened
    ? (opened.minutes * (budget + (input.usedMinutes ?? 0))) / opened.dayMinutes
    : remaining * share;

  const study = getReviewLessonMinutes({ input, writingMinutes });
  const room = study > 0 ? Math.max(0, remaining - study) : target;
  return Math.min(target, practice.length * PRACTICE_MINUTES_PER_QUESTION, room);
}
