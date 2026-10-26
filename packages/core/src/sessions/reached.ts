import { type BeltColor, calculateBeltLevel } from "@zoonk/utils/belt-level";

/** Energy is celebrated at every tenth on its way to the full 100. */
const ENERGY_STEP = 10;

/** What a finished block took the learner to: a new belt level, a new tenth of Energy. */
export type Reached = {
  /** The tenth of Energy the block's answers reached going up (60, 80, 100), or null. */
  energy: number | null;
  /** The belt level its Brain Power (the day's bonus included) reached, or null. */
  level: { color: BeltColor; level: number } | null;
};

/** The belt level a block's Brain Power took the learner to, when it crossed into a new one. */
export function getLevelReached({
  after,
  before,
}: {
  after: number;
  before: number;
}): Reached["level"] {
  const from = calculateBeltLevel(before);
  const to = calculateBeltLevel(after);

  if (from.color === to.color && from.level === to.level) {
    return null;
  }

  return { color: to.color, level: to.level };
}

/**
 * The highest tenth of Energy a block took the learner to on the way up, when it crossed one:
 * Energy that dropped, or moved within a tenth, reached nothing new.
 */
export function getEnergyReached({
  after,
  before,
}: {
  after: number;
  before: number;
}): Reached["energy"] {
  const step = Math.floor(after / ENERGY_STEP) * ENERGY_STEP;
  return step > before && step > 0 ? step : null;
}
