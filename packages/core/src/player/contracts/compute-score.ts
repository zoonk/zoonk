import { BRAIN_POWER_PER_LESSON } from "@zoonk/utils/brain-power";
import { ENERGY_PER_CORRECT, ENERGY_PER_INCORRECT, ENERGY_PER_STATIC } from "../../progress/energy";
import { type AnswerResult } from "./check-answer";

export type ScoreResult = {
  brainPower: number;
  correctCount: number;
  energyDelta: number;
  incorrectCount: number;
};

type ScoredStepResult = Pick<AnswerResult, "answerCounts" | "isCorrect">;

/**
 * Computes completion rewards from checked step results.
 *
 * Client-side completion previews and server-side saved progress both call
 * this function so brain power, energy, and answer counts stay consistent.
 * Lessons without checked answers still award a small energy gain because
 * static reading steps count as completing useful lesson work.
 */
export function computeLessonScore({ results }: { results: ScoredStepResult[] }): ScoreResult {
  const correctCount = results.reduce(
    (total, result) => total + (result.answerCounts?.correct ?? Number(result.isCorrect)),
    0,
  );

  const incorrectCount = results.reduce(
    (total, result) => total + (result.answerCounts?.incorrect ?? Number(!result.isCorrect)),
    0,
  );

  const energyDelta =
    results.length === 0
      ? ENERGY_PER_STATIC
      : correctCount * ENERGY_PER_CORRECT + incorrectCount * ENERGY_PER_INCORRECT;

  return {
    brainPower: BRAIN_POWER_PER_LESSON,
    correctCount,
    energyDelta: Math.round(energyDelta * 100) / 100,
    incorrectCount,
  };
}
