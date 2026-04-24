import { type CompletionResult } from "@zoonk/core/player/contracts/completion-input-schema";
import {
  type ActivityScoringInput,
  buildScoringInput,
  computeActivityScore,
} from "@zoonk/core/player/contracts/compute-score";
import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { type PlayerState } from "./player-reducer";

function buildClientScoringInput(state: PlayerState): ActivityScoringInput {
  return buildScoringInput({
    activityKind: state.activityKind,
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
    correctCount: score.correctCount,
    energyDelta: score.energyDelta,
    incorrectCount: score.incorrectCount,
    newTotalBp,
  };
}
