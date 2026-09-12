import {
  type SerializedLesson,
  type SerializedStep,
} from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerProgressSnapshot } from "@zoonk/core/player/contracts/progress-snapshot";
import { type PlayerCompletionMilestoneKey } from "./completion-milestone-keys";
import { getLocalDate } from "./player-date";
import { type PlayerState, type SelectedAnswer } from "./player-reducer";

export function buildInitialAnswers(steps: SerializedStep[]): Record<string, SelectedAnswer> {
  const entries: [string, SelectedAnswer][] = [];

  for (const step of steps) {
    if (step.kind === "sortOrder" && step.sortOrderItems.length > 0) {
      entries.push([step.id, { kind: "sortOrder", userOrder: step.sortOrderItems }]);
    }
  }

  return Object.fromEntries(entries);
}

export type InitialStateInput = {
  lesson: SerializedLesson;
  progressSnapshot?: PlayerProgressSnapshot | null;
  shownCompletionMilestoneKeys?: PlayerCompletionMilestoneKey[];
  totalBrainPower: number;
};

export function createInitialState({
  lesson,
  progressSnapshot = null,
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
    phase: lesson.steps.length === 0 ? "completed" : "playing",
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
