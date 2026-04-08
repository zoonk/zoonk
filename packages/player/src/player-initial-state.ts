import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type PlayerPhase, type PlayerState, type SelectedAnswer } from "./player-reducer";
import { type SerializedActivity, type SerializedStep } from "./prepare-activity-data";

/**
 * Returns true if the step is an investigation problem step.
 *
 * Problem steps are read-only (no user selection), so they need
 * a pre-set answer to enable the "Investigate" button in the bottom bar.
 */
function isInvestigationProblemStep(step: SerializedStep): boolean {
  if (step.kind !== "investigation") {
    return false;
  }

  const content = parseStepContent("investigation", step.content);
  return content.variant === "problem";
}

export function buildInitialAnswers(steps: SerializedStep[]): Record<string, SelectedAnswer> {
  const entries: [string, SelectedAnswer][] = [];

  for (const step of steps) {
    if (step.kind === "sortOrder" && step.sortOrderItems.length > 0) {
      entries.push([step.id, { kind: "sortOrder", userOrder: step.sortOrderItems }]);
    }

    if (isInvestigationProblemStep(step)) {
      entries.push([step.id, { kind: "investigation", variant: "problem" }]);
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
