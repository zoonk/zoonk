import { type StoryAlignment, parseStepContent } from "@zoonk/core/steps/content-contract";
import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { type CompletionResult } from "./completion-input-schema";
import { computeScore, computeStoryScore } from "./compute-score";
import { type PlayerState } from "./player-reducer";

/**
 * Extract the alignment of each selected choice from story step results.
 *
 * Looks up each answer's selectedChoiceId in the step content to find
 * the alignment tag. Used to compute story-specific scoring (energy by
 * alignment instead of correct/incorrect counts).
 */
function getStoryAlignments(state: PlayerState): StoryAlignment[] {
  return state.steps.flatMap((step) => {
    const result = state.results[step.id];

    if (!result?.answer || result.answer.kind !== "story") {
      return [];
    }

    const { selectedChoiceId } = result.answer;
    const content = parseStepContent("story", step.content);
    const choice = content.choices.find((option) => option.id === selectedChoiceId);

    return choice ? [choice.alignment] : [];
  });
}

/**
 * Computes the completion result from local player state.
 *
 * All inputs (correct/incorrect answers, totalBrainPower) are
 * already available on the client, so we can show metrics instantly without
 * waiting for a server round-trip. The server still validates and persists
 * in the background via `after()`.
 */
export function computeLocalCompletion(state: PlayerState): CompletionResult {
  const isStory = state.steps[0]?.kind === "story";

  const score = isStory
    ? computeStoryScore({ alignments: getStoryAlignments(state) })
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
