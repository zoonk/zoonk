import {
  type SerializedActivity,
  type SerializedStep,
} from "@zoonk/core/player/contracts/prepare-activity-data";
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
  activity: SerializedActivity;
  totalBrainPower: number;
};

export function createInitialState({ activity, totalBrainPower }: InitialStateInput): PlayerState {
  const now = Date.now();

  return {
    activityId: activity.id,
    activityKind: activity.kind,
    completion: null,
    currentStepIndex: 0,
    phase: getInitialPhase(activity.steps),
    results: {},
    selectedAnswers: buildInitialAnswers(activity.steps),
    startedAt: now,
    stepStartedAt: now,
    stepTimings: {},
    steps: activity.steps,
    totalBrainPower,
  };
}
