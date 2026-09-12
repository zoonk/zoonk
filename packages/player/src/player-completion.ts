import { type CompletionResult } from "@zoonk/core/player/contracts/completion-input-schema";
import { computeLessonScore } from "@zoonk/core/player/contracts/compute-score";
import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { type PlayerState } from "./player-reducer";

/**
 * Computes the completion result from local player state.
 *
 * All inputs (correct/incorrect answers, totalBrainPower) are
 * available locally for guest completion and preparing the final transition.
 * Authenticated completion replaces these values with the server receipt before
 * rewards are displayed.
 */
export function computeLocalCompletion(state: PlayerState): CompletionResult {
  const score = computeLessonScore({
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
