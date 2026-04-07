import { type PlayerPhase, type PlayerState, type SelectedAnswer } from "./player-reducer";
import { type SerializedActivity, type SerializedStep } from "./prepare-activity-data";

export function buildInitialAnswers(steps: SerializedStep[]): Record<string, SelectedAnswer> {
  return Object.fromEntries(
    steps
      .filter((step) => step.kind === "sortOrder" && step.sortOrderItems.length > 0)
      .map((step) => [step.id, { kind: "sortOrder" as const, userOrder: step.sortOrderItems }]),
  );
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
    completion: null,
    currentStepIndex: 0,
    investigationLoop: null,
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
