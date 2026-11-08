import { isFullReviewDay } from "../full-review";
import { type PlannedBlock, type PlannedLesson, type SessionBuildInput } from "../session-builder";
import {
  canAddSessionLessons,
  getLessonMinutes,
  getNewLessons,
  isSessionReviewDay,
  takeLessons,
  toLessonBlock,
} from "./session-lessons";

function getPlannedSessionTotal({
  budget,
  holdsMore,
  overflow,
  sum,
}: {
  budget: number;
  holdsMore: boolean;
  overflow: boolean;
  sum: number;
}): number {
  if (overflow) {
    return Math.ceil(sum);
  }

  return Math.ceil(holdsMore ? budget : Math.min(budget, sum));
}

export function fillRemainingLessonTime({
  blocks,
  budget,
  checkpointMinutes,
  input,
  learnBudget,
  lessons,
  produceMinutes,
  reinforcement,
}: {
  blocks: PlannedBlock[];
  budget: number;
  checkpointMinutes: number;
  input: SessionBuildInput;
  learnBudget: number;
  lessons: PlannedLesson[];
  produceMinutes: number;
  reinforcement: PlannedLesson[];
}) {
  const used = blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0);
  const taken = new Set([...reinforcement, ...lessons].map((lesson) => lesson.lessonId));

  const candidates = getNewLessons({
    ...input,
    lessons: [...input.lessons, ...(input.fillLessons ?? [])],
  }).filter((lesson) => !taken.has(lesson.lessonId));

  const fill = takeLessons({
    budget: budget - used - (input.writingMinutes ?? 0),
    lessons: candidates,
    overflow: false,
  });

  const filled = [...blocks, ...fill.map((lesson) => toLessonBlock(lesson, false))];
  const sum = filled.reduce((total, block) => total + block.estimatedMinutes, 0);

  const newLessonsAllowed = canAddSessionLessons({
    reviewDay: isSessionReviewDay(input),
    trialEnded: input.examTrialEnded,
  });

  const holdsMore =
    newLessonsAllowed && ((input.writingMinutes ?? 0) > 0 || candidates.length > fill.length);

  const deliberateOverflow =
    isFullReviewDay(input) ||
    checkpointMinutes + produceMinutes > budget ||
    (lessons.length === 1 && getLessonMinutes(lessons) > learnBudget);

  const plannedMinutes = getPlannedSessionTotal({
    budget,
    holdsMore,
    overflow: deliberateOverflow,
    sum,
  });

  return { blocks: filled, plannedMinutes };
}
