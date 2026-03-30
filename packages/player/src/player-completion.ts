import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { type CompletionResult } from "./completion-input-schema";
import { computeScore } from "./compute-score";
import { type PlayerState } from "./player-reducer";

/**
 * Computes the completion result from local player state.
 *
 * All inputs (correct/incorrect answers, totalBrainPower) are
 * already available on the client, so we can show metrics instantly without
 * waiting for a server round-trip. The server still validates and persists
 * in the background via `after()`.
 */
export function computeLocalCompletion(state: PlayerState): CompletionResult {
  const score = computeScore({
    results: Object.values(state.results).map((stepResult) => ({
      isCorrect: stepResult.result.isCorrect,
    })),
  });

  const newTotalBp = state.totalBrainPower + score.brainPower;

  return {
    belt: calculateBeltLevel(newTotalBp),
    brainPower: score.brainPower,
    energyDelta: score.energyDelta,
    newTotalBp,
  };
}
