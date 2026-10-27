import { BELT_COLORS_ORDER, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { z } from "zod";

/** Energy is celebrated at every tenth on its way to the full 100. */
const ENERGY_STEP = 10;

/**
 * What a block or a mock took the learner to: a new belt level, a new tenth of Energy. Saved with
 * a mock's result, so every read of it can celebrate them.
 */
export const reachedSchema = z.object({
  energy: z
    .int()
    .nullable()
    .meta({ description: "The tenth of Energy its answers reached going up (60, 80, 100)" }),
  level: z
    .object({ color: z.enum(BELT_COLORS_ORDER), level: z.int().min(0) })
    .nullable()
    .meta({ description: "The belt level its Brain Power reached, the day's bonus included" }),
});

export type Reached = z.infer<typeof reachedSchema>;

/** Nothing new reached: a retry, or work that crossed neither a level nor a tenth of Energy. */
export const NOTHING_REACHED: Reached = { energy: null, level: null };

/** A total before and after the work that moved it. */
type Change = { after: number; before: number };

/** The belt level a block's Brain Power took the learner to, when it crossed into a new one. */
export function getLevelReached({ after, before }: Change): Reached["level"] {
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
export function getEnergyReached({ after, before }: Change): Reached["energy"] {
  const step = Math.floor(after / ENERGY_STEP) * ENERGY_STEP;
  return step > before && step > 0 ? step : null;
}

/** The level and the tenth of Energy that work's Brain Power and Energy took the learner to. */
export function getReached({
  brainPower,
  energy,
}: {
  brainPower: Change;
  energy: Change;
}): Reached {
  return { energy: getEnergyReached(energy), level: getLevelReached(brainPower) };
}
