import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { type CompletionProgress } from "../completion-milestones";

const LEVEL_HALFWAY_DIVISOR = 2;

export type LevelCompletionMilestone =
  | { belt: BeltLevelResult; kind: "level"; status: "achieved" }
  | {
      currentBelt: BeltLevelResult;
      kind: "level";
      remainingLessons: number;
      status: "halfway";
      targetBelt: BeltLevelResult;
    };

/**
 * A belt milestone should only celebrate when the learner crosses into a new
 * visible belt state. Comparing both color and level covers same-color level
 * gains and color changes like White 10 to Yellow 1.
 */
function hasReachedNewBeltLevel({
  currentBelt,
  previousBelt,
}: {
  currentBelt: BeltLevelResult;
  previousBelt: BeltLevelResult;
}) {
  return currentBelt.color !== previousBelt.color || currentBelt.level !== previousBelt.level;
}

/**
 * Halfway milestones should fire once per level, exactly when the new total
 * moves from the first half of the current level into the second half. This
 * keeps the screen meaningful without showing it again on every later lesson.
 */
function hasReachedLevelHalfway({
  currentBelt,
  previousBelt,
}: {
  currentBelt: BeltLevelResult;
  previousBelt: BeltLevelResult;
}) {
  const halfwayBp = currentBelt.bpPerLevel / LEVEL_HALFWAY_DIVISOR;

  const stayedInSameLevel =
    currentBelt.color === previousBelt.color && currentBelt.level === previousBelt.level;

  return (
    stayedInSameLevel &&
    !currentBelt.isMaxLevel &&
    previousBelt.progressInLevel < halfwayBp &&
    currentBelt.progressInLevel >= halfwayBp
  );
}

/**
 * The halfway message names the next visible belt state, not the level the
 * learner is currently inside. Adding the remaining BP to the current total
 * asks the shared belt calculator for that next visible state directly.
 */
function getNextBeltLevel({
  currentBelt,
  totalBrainPower,
}: {
  currentBelt: BeltLevelResult;
  totalBrainPower: number;
}) {
  return calculateBeltLevel(totalBrainPower + currentBelt.bpToNextLevel);
}

/**
 * The milestone copy talks in lessons because that is the action learners can
 * take next. Using the current lesson reward keeps the estimate aligned with
 * the same scoring contract that produced the completion result.
 */
function getRemainingLessonCount({
  brainPower,
  currentBelt,
}: {
  brainPower: number;
  currentBelt: BeltLevelResult;
}) {
  if (brainPower <= 0) {
    return currentBelt.bpToNextLevel;
  }

  return Math.ceil(currentBelt.bpToNextLevel / brainPower);
}

/**
 * Builds the level milestone for a completion. Achieved level changes outrank
 * halfway nudges inside this family, so crossing a belt boundary never also
 * shows the halfway message for the level that just ended.
 */
export function getLevelCompletionMilestone({
  completion,
  previousTotalBrainPower,
}: {
  completion: CompletionProgress;
  previousTotalBrainPower: number;
}): LevelCompletionMilestone | null {
  const currentBelt = calculateBeltLevel(completion.newTotalBp);
  const previousBelt = calculateBeltLevel(previousTotalBrainPower);

  if (hasReachedNewBeltLevel({ currentBelt, previousBelt })) {
    return { belt: currentBelt, kind: "level", status: "achieved" };
  }

  if (!hasReachedLevelHalfway({ currentBelt, previousBelt })) {
    return null;
  }

  return {
    currentBelt,
    kind: "level",
    remainingLessons: getRemainingLessonCount({ brainPower: completion.brainPower, currentBelt }),
    status: "halfway",
    targetBelt: getNextBeltLevel({ currentBelt, totalBrainPower: completion.newTotalBp }),
  };
}
