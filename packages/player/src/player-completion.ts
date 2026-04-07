import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { type CompletionResult } from "./completion-input-schema";
import {
  type ActivityScoringInput,
  buildScoringInput,
  computeActivityScore,
} from "./compute-score";
import { type PlayerState } from "./player-reducer";

/**
 * Builds the ActivityScoringInput from client-side PlayerState.
 *
 * Delegates to the shared buildScoringInput, normalizing the client's
 * data shapes (steps as SerializedStep[], results as StepResult records)
 * into the format the unified scorer expects.
 */
function getActivityKind(steps: PlayerState["steps"]): string {
  if (steps.some((step) => step.kind === "investigation")) {
    return "investigation";
  }

  if (steps.some((step) => step.kind === "story")) {
    return "story";
  }

  return "generic";
}

function buildClientScoringInput(state: PlayerState): ActivityScoringInput {
  const activityKind = getActivityKind(state.steps);

  return buildScoringInput({
    activityKind,
    answers: state.selectedAnswers,
    investigationLoop: state.investigationLoop,
    stepResults: Object.values(state.results).map((stepResult) => ({
      isCorrect: stepResult.result.isCorrect,
    })),
    steps: state.steps,
  });
}

/**
 * Computes the completion result from local player state.
 *
 * All inputs (correct/incorrect answers, totalBrainPower) are
 * already available on the client, so we can show metrics instantly without
 * waiting for a server round-trip. The server computes the same score
 * via computeActivityScore + buildScoringInput to ensure consistency.
 */
export function computeLocalCompletion(state: PlayerState): CompletionResult {
  const score = computeActivityScore(buildClientScoringInput(state));
  const newTotalBp = state.totalBrainPower + score.brainPower;

  return {
    belt: calculateBeltLevel(newTotalBp),
    brainPower: score.brainPower,
    energyDelta: score.energyDelta,
    newTotalBp,
  };
}
