import {
  type SerializedLesson,
  type SerializedStep,
} from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerCompletionMilestoneKey } from "./completion-milestone-keys";
import { type PlayerProgressSnapshot } from "./completion-milestones";
import { getLocalDate } from "./player-date";
import { type PlayerPhase, type PlayerState, type SelectedAnswer } from "./player-reducer";

export function buildInitialAnswers(steps: SerializedStep[]): Record<string, SelectedAnswer> {
  const entries: [string, SelectedAnswer][] = [];

  for (const step of steps) {
    if (step.kind === "sortOrder" && step.sortOrderItems.length > 0) {
      entries.push([step.id, { kind: "sortOrder", userOrder: step.sortOrderItems }]);
    }
  }

  return Object.fromEntries(entries);
}

function getInitialPhase({
  requiresStartConfirmation,
  steps,
}: {
  requiresStartConfirmation: boolean;
  steps: SerializedStep[];
}): PlayerPhase {
  if (steps.length === 0) {
    return "completed";
  }

  if (requiresStartConfirmation) {
    return "startWarning";
  }

  return "playing";
}

export type InitialStateInput = {
  lesson: SerializedLesson;
  progressSnapshot?: PlayerProgressSnapshot | null;
  requiresStartConfirmation?: boolean;
  shownCompletionMilestoneKeys?: PlayerCompletionMilestoneKey[];
  totalBrainPower: number;
};

export function createInitialState({
  lesson,
  progressSnapshot = null,
  requiresStartConfirmation = false,
  shownCompletionMilestoneKeys = [],
  totalBrainPower,
}: InitialStateInput): PlayerState {
  const now = Date.now();

  return {
    completion: null,
    completionMilestoneIndex: null,
    currentStepIndex: 0,
    lessonId: lesson.id,
    lessonKind: lesson.kind,
    localDate: getLocalDate(new Date(now)),
    phase: getInitialPhase({ requiresStartConfirmation, steps: lesson.steps }),
    progressSnapshot,
    results: {},
    selectedAnswers: buildInitialAnswers(lesson.steps),
    shownCompletionMilestoneKeys,
    startedAt: now,
    stepStartedAt: now,
    stepTimings: {},
    steps: lesson.steps,
    totalBrainPower,
  };
}
