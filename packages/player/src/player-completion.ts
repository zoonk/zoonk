import { type CompletionResult } from "@zoonk/core/player/contracts/completion-input-schema";
import { computeActivityScore } from "@zoonk/core/player/contracts/compute-score";
import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { type PlayerState } from "./player-reducer";

/**
 * Computes the completion result from local player state.
 *
 * All inputs (correct/incorrect answers, totalBrainPower) are
 * already available on the client, so we can show metrics instantly without
 * waiting for a server round-trip. The server calls the same scoring function
 * so local preview and saved progress stay aligned.
 */
export function computeLocalCompletion(state: PlayerState): CompletionResult {
  const score = computeActivityScore({
    results: Object.values(state.results).map((stepResult) => stepResult.result),
  });

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
