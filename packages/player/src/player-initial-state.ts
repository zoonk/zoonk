import { type ChallengeEffect, parseStepContent } from "@zoonk/core/steps/content-contract";
import {
  type DimensionInventory,
  type PlayerPhase,
  type PlayerState,
  type SelectedAnswer,
} from "./player-reducer";
import { type SerializedActivity, type SerializedStep } from "./prepare-activity-data";

function getChallengeEffects(step: SerializedStep): ChallengeEffect[] {
  if (step.kind !== "multipleChoice") {
    return [];
  }

  const content = parseStepContent("multipleChoice", step.content);

  if (content.kind !== "challenge") {
    return [];
  }

  return content.options.flatMap((option) => option.effects);
}

export function collectAllDimensions(steps: SerializedStep[]): DimensionInventory {
  const effects = steps.flatMap((step) => getChallengeEffects(step));

  return Object.fromEntries(effects.map((effect) => [effect.dimension, 0]));
}

export function buildInitialAnswers(steps: SerializedStep[]): Record<string, SelectedAnswer> {
  return Object.fromEntries(
    steps
      .filter((step) => step.kind === "sortOrder" && step.sortOrderItems.length > 0)
      .map((step) => [step.id, { kind: "sortOrder" as const, userOrder: step.sortOrderItems }]),
  );
}

function getInitialPhase(steps: SerializedStep[], dimensions: DimensionInventory): PlayerPhase {
  if (steps.length === 0) {
    return "completed";
  }

  if (Object.keys(dimensions).length > 0) {
    return "intro";
  }

  return "playing";
}

export type InitialStateInput = {
  activity: SerializedActivity;
  totalBrainPower: number;
};

export function createInitialState({ activity, totalBrainPower }: InitialStateInput): PlayerState {
  const dimensions = collectAllDimensions(activity.steps);
  const now = Date.now();

  return {
    activityId: activity.id,
    completion: null,
    currentStepIndex: 0,
    dimensions,
    phase: getInitialPhase(activity.steps, dimensions),
    previousDimensions: { ...dimensions },
    results: {},
    selectedAnswers: buildInitialAnswers(activity.steps),
    startedAt: now,
    stepStartedAt: now,
    stepTimings: {},
    steps: activity.steps,
    totalBrainPower,
  };
}
