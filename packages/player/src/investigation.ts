import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import {
  type InvestigationActionQuality,
  type InvestigationStepContent,
} from "@zoonk/core/steps/contract/content";
import { type PlayerState } from "./player-reducer";
import { describePlayerStep } from "./player-step";

export type ActionTiming = {
  answeredAt: number;
  dayOfWeek: number;
  durationSeconds: number;
  hourOfDay: number;
};

export type InvestigationLoopState = {
  actionTimings: ActionTiming[];
  usedActionIds: string[];
};

type InvestigationVariant = InvestigationStepContent["variant"];

/**
 * Finds the investigation step matching a specific variant (problem, action,
 * call) from the player's step list.
 *
 * Investigation activities store each variant as a separate physical step
 * with `kind: "investigation"`. This helper scans all steps and parses
 * their content to find the one with the requested variant. Returns
 * null if no matching step exists.
 */
export function getInvestigationStepByVariant(
  steps: SerializedStep[],
  variant: InvestigationVariant,
): SerializedStep | null {
  return (
    steps.find((step) => {
      const descriptor = describePlayerStep(step);

      if (descriptor?.kind === "investigationAction") {
        return variant === "action";
      }

      if (descriptor?.kind === "investigationCall") {
        return variant === "call";
      }

      if (descriptor?.kind === "investigationProblem") {
        return variant === "problem";
      }

      return false;
    }) ?? null
  );
}

/**
 * Returns available investigation actions by filtering out already-used
 * actions. Each action can only be selected once during the
 * investigation loop. Uses stable IDs so lookups are
 * order-independent (safe across shuffling).
 */
export function getAvailableActions(
  actions: { id: string; label: string; quality: InvestigationActionQuality }[],
  usedIds: string[],
): { id: string; label: string; quality: InvestigationActionQuality }[] {
  const usedSet = new Set(usedIds);

  return actions.flatMap((action) =>
    usedSet.has(action.id) ? [] : [{ id: action.id, label: action.label, quality: action.quality }],
  );
}

/**
 * Returns the scenario text from the problem step for the scenario
 * recall popover in the sticky header.
 *
 * Returns null when the current step is not an investigation step
 * or when the learner is still on the problem step itself (where
 * the scenario is already visible).
 */
export function getInvestigationScenario(state: PlayerState): {
  scenario: string;
} | null {
  const descriptor = describePlayerStep(state.steps[state.currentStepIndex]);

  if (
    descriptor?.kind !== "investigationAction" &&
    descriptor?.kind !== "investigationCall" &&
    descriptor?.kind !== "investigationProblem"
  ) {
    return null;
  }

  if (descriptor.kind === "investigationProblem") {
    return null;
  }

  const problemStep = getInvestigationStepByVariant(state.steps, "problem");
  const problemDescriptor = describePlayerStep(problemStep);

  if (problemDescriptor?.kind !== "investigationProblem") {
    return null;
  }

  return { scenario: problemDescriptor.content.scenario };
}
