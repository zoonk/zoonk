import {
  type InvestigationStepContent,
  parseStepContent,
} from "@zoonk/core/steps/contract/content";
import { type PlayerState } from "./player-reducer";
import { type SerializedStep } from "./prepare-activity-data";

export type ActionTiming = {
  answeredAt: number;
  dayOfWeek: number;
  durationSeconds: number;
  hourOfDay: number;
};

export type InvestigationLoopState = {
  actionTimings: ActionTiming[];
  usedActionIndices: number[];
};

type InvestigationVariant = InvestigationStepContent["variant"];

/**
 * Finds the investigation step matching a specific variant (problem, action,
 * call) from the player's step list.
 *
 * Investigation activities store each variant as a separate physical step
 * with `kind: "investigation"`. This helper scans all steps and parses
 * their content to find the one with the requested variant. Returns
 * undefined if no matching step exists.
 */
export function getInvestigationStepByVariant(
  steps: SerializedStep[],
  variant: InvestigationVariant,
): SerializedStep | undefined {
  return steps.find((step) => {
    if (step.kind !== "investigation") {
      return false;
    }

    const content = parseStepContent("investigation", step.content);
    return content.variant === variant;
  });
}

/**
 * Returns available investigation actions by filtering out already-used
 * action indices. Each action can only be selected once during the
 * investigation loop.
 */
export function getAvailableActions(
  actions: { label: string; quality: "critical" | "useful" | "weak" }[],
  usedIndices: number[],
): { originalIndex: number; label: string; quality: "critical" | "useful" | "weak" }[] {
  const usedSet = new Set(usedIndices);

  return actions.flatMap((action, index) =>
    usedSet.has(index)
      ? []
      : [{ label: action.label, originalIndex: index, quality: action.quality }],
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
  const currentStep = state.steps[state.currentStepIndex];

  if (!currentStep || currentStep.kind !== "investigation") {
    return null;
  }

  const currentContent = parseStepContent("investigation", currentStep.content);

  if (currentContent.variant === "problem") {
    return null;
  }

  const problemStep = getInvestigationStepByVariant(state.steps, "problem");

  if (!problemStep) {
    return null;
  }

  const problemContent = parseStepContent("investigation", problemStep.content);

  if (problemContent.variant !== "problem") {
    return null;
  }

  return { scenario: problemContent.scenario };
}
