import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { type CompletionResult } from "./completion-input-schema";
import { computeChallengeScore, computeScore } from "./compute-score";
import { hasNegativeDimension } from "./dimensions";
import { type PlayerState } from "./player-reducer";

/**
 * Computes the completion result from local player state.
 *
 * All inputs (correct/incorrect answers, dimensions, totalBrainPower) are
 * already available on the client, so we can show metrics instantly without
 * waiting for a server round-trip. The server still validates and persists
 * in the background via `after()`.
 */
export function computeLocalCompletion(state: PlayerState): CompletionResult {
  const isChallenge = Object.keys(state.dimensions).length > 0;
  const isSuccessful = !hasNegativeDimension(state.dimensions);

  const score = isChallenge
    ? computeChallengeScore({ dimensions: state.dimensions, isSuccessful })
    : computeScore({
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
