import {
  type InvestigationStepContent,
  parseStepContent,
} from "@zoonk/core/steps/contract/content";
import { type InvestigationScoreInput, buildScoringInput } from "./compute-score";
import { type PlayerState } from "./player-reducer";
import { type SerializedStep } from "./prepare-activity-data";

export type InvestigationLoopState = {
  hunchIndex: number;
  usedActionIndices: number[];
  experimentResults: { actionIndex: number; isCorrect: boolean }[];
};

type InvestigationVariant = InvestigationStepContent["variant"];

/**
 * Finds the investigation step matching a specific variant (problem, action,
 * evidence, call) from the player's step list.
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
 * Checks whether a step is the investigation score screen
 * (a static step with variant "investigationScore").
 *
 * These steps use a "Continue" button for forward-only navigation
 * rather than arrow keys, similar to story static variants.
 */
export function isInvestigationScoreVariant(step?: SerializedStep): boolean {
  if (!step || step.kind !== "static") {
    return false;
  }

  const content = parseStepContent("static", step.content);
  return content.variant === "investigationScore";
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
 * Reads the problem step content and the learner's selected hunch
 * to return the hunch text for the sticky header popover.
 *
 * Returns null when:
 * - The current step is not an investigation step
 * - The learner hasn't picked a hunch yet (still on the problem step)
 * - The current step is the call or score step (spec says hunch is
 *   shown only during action and evidence steps)
 */
export function getInvestigationHunchText(state: PlayerState): string | null {
  const currentStep = state.steps[state.currentStepIndex];

  if (!currentStep || currentStep.kind !== "investigation") {
    return null;
  }

  const currentContent = parseStepContent("investigation", currentStep.content);

  if (currentContent.variant === "problem" || currentContent.variant === "call") {
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

  const hunchIndex = state.investigationLoop?.hunchIndex;

  if (hunchIndex === undefined || hunchIndex === null) {
    return null;
  }

  return problemContent.explanations[hunchIndex]?.text ?? null;
}

/**
 * Extracts the investigation scoring input from player state.
 *
 * Delegates to the shared `buildScoringInput` using the client's
 * investigation loop, steps, and answers. Returns null if the
 * activity isn't an investigation or required data is missing.
 */
export function extractInvestigationScoreInput(state: PlayerState): InvestigationScoreInput | null {
  if (!state.investigationLoop) {
    return null;
  }

  const scoringInput = buildScoringInput({
    activityKind: "investigation",
    answers: state.selectedAnswers,
    investigationLoop: state.investigationLoop,
    stepResults: [],
    steps: state.steps,
  });

  if (scoringInput.kind !== "investigation") {
    return null;
  }

  return scoringInput.investigation;
}

export type JourneyOutcome =
  | "changedCorrect"
  | "changedIncorrect"
  | "stayedCorrect"
  | "stayedIncorrect";

export type JourneyNarrativeData = {
  actionLabels: string[];
  hunchText: string;
  outcome: JourneyOutcome;
};

/**
 * Computes the structured journey data for the debrief screen.
 *
 * Returns raw data (hunch text, action labels, outcome type) instead
 * of translated strings. The component uses useExtracted to translate
 * the outcome into the appropriate narrative line.
 */
export function buildJourneyData({
  actionLabels,
  hunchText,
  isCallCorrect,
  mindChanged,
}: {
  actionLabels: string[];
  hunchText: string;
  isCallCorrect: boolean;
  mindChanged: boolean;
}): JourneyNarrativeData {
  function getOutcome(): JourneyOutcome {
    if (mindChanged && isCallCorrect) {
      return "changedCorrect";
    }

    if (mindChanged) {
      return "changedIncorrect";
    }

    if (isCallCorrect) {
      return "stayedCorrect";
    }

    return "stayedIncorrect";
  }

  return { actionLabels, hunchText, outcome: getOutcome() };
}
