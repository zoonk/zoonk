import { type StoryAlignment, parseStepContent } from "@zoonk/core/steps/contract/content";
import { APPLIED_ACTIVITY_BRAIN_POWER, BRAIN_POWER_PER_ACTIVITY } from "@zoonk/utils/brain-power";
import { ENERGY_PER_CORRECT, ENERGY_PER_INCORRECT, ENERGY_PER_STATIC } from "@zoonk/utils/energy";
import { type InvestigationLoopState } from "./investigation";
import { type SelectedAnswer } from "./player-reducer";

// ---------------------------------------------------------------------------
// ScoreResult — the universal output of all scoring functions
// ---------------------------------------------------------------------------

export type ScoreResult = {
  brainPower: number;
  correctCount: number;
  energyDelta: number;
  incorrectCount: number;
};

// ---------------------------------------------------------------------------
// Generic activity scoring (quiz, explanation, practice, etc.)
// ---------------------------------------------------------------------------

function calculateEnergyDelta(results: { isCorrect: boolean }[]): number {
  if (results.length === 0) {
    return ENERGY_PER_STATIC;
  }

  const correctCount = results.filter((result) => result.isCorrect).length;
  const incorrectCount = results.length - correctCount;
  return correctCount * ENERGY_PER_CORRECT + incorrectCount * ENERGY_PER_INCORRECT;
}

function computeScore({ results }: { results: { isCorrect: boolean }[] }): ScoreResult {
  const correctCount = results.filter((result) => result.isCorrect).length;
  const incorrectCount = results.length - correctCount;
  const energyDelta = calculateEnergyDelta(results);

  return {
    brainPower: BRAIN_POWER_PER_ACTIVITY,
    correctCount,
    energyDelta: Math.round(energyDelta * 100) / 100,
    incorrectCount,
  };
}

// ---------------------------------------------------------------------------
// Story activity scoring
// ---------------------------------------------------------------------------

const STORY_ENERGY_BY_ALIGNMENT: Record<StoryAlignment, number> = {
  partial: 1,
  strong: 3,
  weak: 0,
};

/**
 * Compute score for a story activity based on choice alignments.
 *
 * Stories earn 100 BP on completion (vs 10 for standard activities).
 * Energy is alignment-based: strong (+3), partial (+1), weak (0).
 * Strong/partial count as correct; weak counts as incorrect for analytics.
 */
function computeStoryScore({ alignments }: { alignments: StoryAlignment[] }): ScoreResult {
  const energyDelta = alignments.reduce(
    (sum, alignment) => sum + STORY_ENERGY_BY_ALIGNMENT[alignment],
    0,
  );

  const correctCount = alignments.filter((alignment) => alignment !== "weak").length;

  return {
    brainPower: APPLIED_ACTIVITY_BRAIN_POWER,
    correctCount,
    energyDelta,
    incorrectCount: alignments.length - correctCount,
  };
}

// ---------------------------------------------------------------------------
// Investigation activity scoring
// ---------------------------------------------------------------------------

const INVESTIGATION_ACTION_ENERGY = {
  critical: 2,
  useful: 1,
  weak: 0,
} as const;

const INVESTIGATION_CALL_ENERGY = {
  best: 6,
  partial: 3,
  wrong: 0,
} as const;

export type InvestigationScoreInput = {
  actionQualities: ("critical" | "useful" | "weak")[];
  callAccuracy: "best" | "partial" | "wrong";
};

/**
 * Computes the investigation score from two energy dimensions:
 *
 * - Action quality: critical (+2), useful (+1), weak (+0) per action
 * - Final call: best (+6), partial (+3), wrong (+0)
 *
 * Max energy with 3 critical actions + best call = 6 + 6 = +12.
 * This is higher than story max (+9) because investigations
 * require more effort (multiple experiments + a final judgment).
 *
 * correctCount includes all graded decisions: each action
 * (critical/useful = correct, weak = incorrect) plus the call
 * (best = correct, partial/wrong = incorrect).
 * Example: 1 critical + 1 useful + 1 weak + wrong call = 2/4.
 */
function computeInvestigationScore(input: InvestigationScoreInput): ScoreResult {
  const actionEnergy = input.actionQualities.reduce(
    (sum, quality) => sum + INVESTIGATION_ACTION_ENERGY[quality],
    0,
  );

  const callEnergy = INVESTIGATION_CALL_ENERGY[input.callAccuracy];
  const correctActions = input.actionQualities.filter((quality) => quality !== "weak").length;
  const callCorrect = input.callAccuracy === "best" ? 1 : 0;

  return {
    brainPower: APPLIED_ACTIVITY_BRAIN_POWER,
    correctCount: correctActions + callCorrect,
    energyDelta: actionEnergy + callEnergy,
    incorrectCount: input.actionQualities.length - correctActions + (1 - callCorrect),
  };
}

// ---------------------------------------------------------------------------
// Unified scoring — single entry point for both client and server
// ---------------------------------------------------------------------------

export type ActivityScoringInput =
  | { kind: "generic"; results: { isCorrect: boolean }[] }
  | { kind: "investigation"; investigation: InvestigationScoreInput }
  | { kind: "story"; alignments: StoryAlignment[] };

/**
 * Single entry point for computing activity scores.
 *
 * Both client (computeLocalCompletion) and server (submitCompletion)
 * must call this function to ensure BP, energy, and counts are
 * consistent. Dispatches to the right scoring function based on
 * activity kind.
 */
export function computeActivityScore(input: ActivityScoringInput): ScoreResult {
  switch (input.kind) {
    case "investigation":
      return computeInvestigationScore(input.investigation);
    case "story":
      return computeStoryScore({ alignments: input.alignments });
    case "generic": // eslint-disable-line unicorn/no-useless-switch-case -- Required by both exhaustiveness-check and default-case rules
    default:
      return computeScore({ results: input.results });
  }
}

// ---------------------------------------------------------------------------
// Scoring input builders — extract ActivityScoringInput from raw data
// ---------------------------------------------------------------------------

/**
 * Extracts story alignments from step content and answers.
 *
 * Works for both client (SerializedStep + SelectedAnswer) and server
 * (DB steps + SelectedAnswer) because both provide step IDs, kinds,
 * content, and answers keyed by step ID string.
 */
function extractStoryAlignments({
  answers,
  steps,
}: {
  answers: Record<string, SelectedAnswer>;
  steps: { id: string; kind: string; content: unknown }[];
}): StoryAlignment[] {
  return steps.flatMap((step) => {
    if (step.kind !== "story") {
      return [];
    }

    const answer = answers[step.id];

    if (!answer || answer.kind !== "story") {
      return [];
    }

    const content = parseStepContent("story", step.content);
    const choice = content.choices.find((option) => option.id === answer.selectedChoiceId);

    return choice ? [choice.alignment] : [];
  });
}

/**
 * Extracts investigation scoring input from step content, answers,
 * and the investigation loop state.
 *
 * The loop state tracks all experiments (action indices and
 * interpretation results) across the dynamic investigation loop.
 * Individual experiment answers can't be reconstructed from the
 * answers map because each loop iteration overwrites the same
 * physical step ID.
 */
function extractInvestigationInput({
  answers,
  investigationLoop,
  steps,
}: {
  answers: Record<string, SelectedAnswer>;
  investigationLoop: InvestigationLoopState;
  steps: { id: string; kind: string; content: unknown }[];
}): InvestigationScoreInput | null {
  const actionStep = steps.find((step) => {
    if (step.kind !== "investigation") {
      return false;
    }

    const parsed = parseStepContent("investigation", step.content);
    return parsed.variant === "action";
  });

  if (!actionStep) {
    return null;
  }

  const actionContent = parseStepContent("investigation", actionStep.content);

  if (actionContent.variant !== "action") {
    return null;
  }

  const actionQualities = investigationLoop.usedActionIds.flatMap((id) => {
    const action = actionContent.actions.find((a) => a.id === id);
    return action ? [action.quality] : [];
  });

  const callStep = steps.find((step) => {
    if (step.kind !== "investigation") {
      return false;
    }

    const parsed = parseStepContent("investigation", step.content);
    return parsed.variant === "call";
  });

  if (!callStep) {
    return null;
  }

  const callContent = parseStepContent("investigation", callStep.content);

  if (callContent.variant !== "call") {
    return null;
  }

  const callAnswer = answers[callStep.id];

  if (!callAnswer || callAnswer.kind !== "investigation" || callAnswer.variant !== "call") {
    return null;
  }

  const selectedExplanation = callContent.explanations.find(
    (explanation) => explanation.id === callAnswer.selectedExplanationId,
  );

  if (!selectedExplanation) {
    return null;
  }

  return { actionQualities, callAccuracy: selectedExplanation.accuracy };
}

/**
 * Builds the scoring input from activity data and answers.
 *
 * Used by the server to produce the same ActivityScoringInput that
 * the client builds from PlayerState. This ensures both sides call
 * computeActivityScore with equivalent data and get the same result.
 *
 * Steps must have string IDs (call String(step.id) for bigint DB IDs).
 */
export function buildScoringInput({
  activityKind,
  answers,
  investigationLoop,
  stepResults,
  steps,
}: {
  activityKind: string;
  answers: Record<string, SelectedAnswer>;
  investigationLoop?: InvestigationLoopState | null;
  stepResults: { isCorrect: boolean }[];
  steps: { id: string; kind: string; content: unknown }[];
}): ActivityScoringInput {
  if (activityKind === "investigation" && investigationLoop) {
    const input = extractInvestigationInput({ answers, investigationLoop, steps });

    if (input) {
      return { investigation: input, kind: "investigation" };
    }
  }

  if (activityKind === "story") {
    const alignments = extractStoryAlignments({ answers, steps });

    if (alignments.length > 0) {
      return { alignments, kind: "story" };
    }
  }

  return { kind: "generic", results: stepResults };
}
