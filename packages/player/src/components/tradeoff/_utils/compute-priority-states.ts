import { type TradeoffStepContent, parseStepContent } from "@zoonk/core/steps/content-contract";
import { type SelectedAnswer } from "../../../player-reducer";
import { type SerializedStep } from "../../../prepare-activity-data";
import { getConsequenceTier } from "./get-consequence-tier";
import { CONSEQUENCE_STATE_DELTAS } from "./state-tier";

const INITIAL_STATE = 1;

/** Filters an activity's steps to only tradeoff rounds. */
function getTradeoffSteps(allSteps: SerializedStep[]): SerializedStep[] {
  return allSteps.filter((step) => step.kind === "tradeoff");
}

/**
 * Applies state modifiers (from events) to a priority state record,
 * returning a new record without mutating the original.
 */
function withStateModifiers(
  states: Record<string, number>,
  content: TradeoffStepContent,
): Record<string, number> {
  if (!content.stateModifiers) {
    return states;
  }

  const result = { ...states };

  for (const modifier of content.stateModifiers) {
    const current = result[modifier.priorityId];

    if (current !== undefined) {
      result[modifier.priorityId] = current + modifier.delta;
    }
  }

  return result;
}

/**
 * Applies allocation deltas to a priority state record based on the
 * learner's token distribution, returning a new record.
 */
function withAllocationDeltas(
  states: Record<string, number>,
  answer: SelectedAnswer | undefined,
): Record<string, number> {
  if (!answer || answer.kind !== "tradeoff") {
    return states;
  }

  const result = { ...states };

  for (const allocation of answer.allocations) {
    const current = result[allocation.priorityId];

    if (current !== undefined) {
      const tier = getConsequenceTier(allocation.tokens);
      result[allocation.priorityId] = current + CONSEQUENCE_STATE_DELTAS[tier];
    }
  }

  return result;
}

/**
 * Computes the accumulated priority states from all tradeoff rounds
 * up to (and optionally including) the current round.
 *
 * Each priority starts at 1 (Stable). Per round:
 * - Invested (2+ tokens) → +1
 * - Maintained (1 token) → 0
 * - Neglected (0 tokens) → -1
 *
 * Events between rounds can apply additional state modifiers
 * (e.g., stress drops Sleep by -1 before the learner allocates).
 */
export function computePriorityStates({
  allSteps,
  currentStepId,
  includeCurrentRound,
  selectedAnswers,
}: {
  allSteps: SerializedStep[];
  currentStepId: string;
  includeCurrentRound: boolean;
  selectedAnswers: Record<string, SelectedAnswer>;
}): Record<string, number> {
  const tradeoffSteps = getTradeoffSteps(allSteps);
  const currentIndex = tradeoffSteps.findIndex((step) => step.id === currentStepId);

  if (currentIndex === -1) {
    return {};
  }

  const firstStep = tradeoffSteps[0];

  if (!firstStep) {
    return {};
  }

  const content = parseStepContent("tradeoff", firstStep.content);

  let states: Record<string, number> = Object.fromEntries(
    content.priorities.map((priority) => [priority.id, INITIAL_STATE]),
  );

  const endIndex = includeCurrentRound ? currentIndex + 1 : currentIndex;

  for (let index = 0; index < endIndex; index += 1) {
    const step = tradeoffSteps[index];

    if (step) {
      const stepContent = parseStepContent("tradeoff", step.content);
      states = withStateModifiers(states, stepContent);
      states = withAllocationDeltas(states, selectedAnswers[step.id]);
    }
  }

  if (!includeCurrentRound) {
    const currentStep = tradeoffSteps[currentIndex];

    if (currentStep) {
      const currentContent = parseStepContent("tradeoff", currentStep.content);
      states = withStateModifiers(states, currentContent);
    }
  }

  return states;
}

/**
 * Returns the round number (1-based) and total rounds for a tradeoff
 * step by counting tradeoff steps in the activity.
 */
export function getTradeoffRoundInfo(
  allSteps: SerializedStep[],
  currentStepId: string,
): { isLastRound: boolean; roundNumber: number; totalRounds: number } {
  const tradeoffSteps = getTradeoffSteps(allSteps);
  const index = tradeoffSteps.findIndex((step) => step.id === currentStepId);
  const roundNumber = index + 1;
  const totalRounds = tradeoffSteps.length;

  return { isLastRound: roundNumber === totalRounds, roundNumber, totalRounds };
}
