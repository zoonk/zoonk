import { isPhaseChallenge } from "../../checkpoints/_utils/challenge-reach";
import { isFullReviewDay } from "../full-review";
import {
  type PlannedBlock,
  type PlannedCheckpoint,
  type PlannedLesson,
  type SessionBuildInput,
} from "../session-builder";
import { listDayStretch, orderDayBlocks } from "./day-stretch";
import { buildCheckpointBlock } from "./planned-checkpoint-block";
import {
  canAddSessionLessons,
  getLessonMinutes,
  getNewLessons,
  isSessionReviewDay,
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
  available,
  blocks,
  budget,
  checkpointMinutes,
  input,
  learnBudget,
  lessons,
  leading,
  produceMinutes,
}: {
  available: PlannedCheckpoint[];
  blocks: PlannedBlock[];
  budget: number;
  checkpointMinutes: number;
  input: SessionBuildInput;
  learnBudget: number;
  lessons: PlannedLesson[];
  leading: PlannedCheckpoint[];
  produceMinutes: number;
}) {
  const fixed = blocks
    .filter((block) => block.kind !== "learn" || block.payload.reinforcement)
    .filter((block) => !block.payload.checkpoint || !isPhaseChallenge(block.payload.checkpoint));

  const candidates = getNewLessons({
    ...input,
    lessons: input.mockReplacesDay ? [] : [...input.lessons, ...(input.fillLessons ?? [])],
  });

  const unique = [
    ...new Map(
      candidates.map((lesson) => [lesson.lessonId ?? lesson.planItemKey, lesson]),
    ).values(),
  ];

  const stretch = listDayStretch({
    budget:
      budget -
      fixed.reduce((sum, block) => sum + block.estimatedMinutes, 0) -
      (input.writingMinutes ?? 0),
    checkpoints: available,
    items: input.planItems ?? [],
    leading,
    lessons: unique,
    overflow: !input.usedMinutes,
  });

  const fill = stretch.flatMap((entry) => (entry.kind === "lesson" ? [entry.lesson] : []));

  const boundary = fixed.findIndex(
    (block) => block.kind === "practice" || block.kind === "produce" || block.kind === "checkpoint",
  );

  const at = boundary === -1 ? fixed.length : boundary;

  const filled = [
    ...fixed.slice(0, at),
    ...stretch.map((entry) =>
      entry.kind === "lesson"
        ? toLessonBlock(entry.lesson, false)
        : buildCheckpointBlock(entry.checkpoint),
    ),
    ...fixed.slice(at),
  ];

  const sum = filled.reduce((total, block) => total + block.estimatedMinutes, 0);

  const newLessonsAllowed = canAddSessionLessons({
    reviewDay: isSessionReviewDay(input),
    trialEnded: input.examTrialEnded,
  });

  const holdsMore =
    !input.mockReplacesDay &&
    newLessonsAllowed &&
    ((input.writingMinutes ?? 0) > 0 || candidates.length > fill.length);

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

  return {
    blocks: orderDayBlocks({ blocks: filled, items: input.planItems ?? [] }),
    plannedMinutes,
  };
}
