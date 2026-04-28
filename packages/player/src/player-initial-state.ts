import {
  type SerializedLesson,
  type SerializedStep,
} from "@zoonk/core/player/contracts/prepare-lesson-data";
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

function getInitialPhase(steps: SerializedStep[]): PlayerPhase {
  if (steps.length === 0) {
    return "completed";
  }

  return "playing";
}

export type InitialStateInput = {
  lesson: SerializedLesson;
  totalBrainPower: number;
};

export function createInitialState({ lesson, totalBrainPower }: InitialStateInput): PlayerState {
  const now = Date.now();

  return {
    completion: null,
    currentStepIndex: 0,
    lessonId: lesson.id,
    lessonKind: lesson.kind,
    phase: getInitialPhase(lesson.steps),
    results: {},
    selectedAnswers: buildInitialAnswers(lesson.steps),
    startedAt: now,
    stepStartedAt: now,
    stepTimings: {},
    steps: lesson.steps,
    totalBrainPower,
  };
}
