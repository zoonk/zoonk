import { BRAIN_POWER_PER_LESSON } from "@zoonk/utils/brain-power";
import { ENERGY_PER_CORRECT, ENERGY_PER_INCORRECT, ENERGY_PER_STATIC } from "../../progress/energy";
import { getStepAnswerCounts } from "./answer-counts";
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
  const counts = results.map((result) => getStepAnswerCounts(result));
  const correctCount = counts.reduce((total, count) => total + count.correct, 0);

  const incorrectCount = counts.reduce((total, count) => total + count.incorrect, 0);

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
