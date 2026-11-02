import { BELT_COLORS_ORDER, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { z } from "zod";

const ENERGY_STEP = 10;

/** Mock results persist reached levels so later reads can celebrate the same achievement. */
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

export const NOTHING_REACHED: Reached = { energy: null, level: null };

type Change = { after: number; before: number };

function getLevelReached({ after, before }: Change): Reached["level"] {
  const from = calculateBeltLevel(before);
  const to = calculateBeltLevel(after);

  if (from.color === to.color && from.level === to.level) {
    return null;
  }

  return { color: to.color, level: to.level };
}

function getEnergyReached({ after, before }: Change): Reached["energy"] {
  const step = Math.floor(after / ENERGY_STEP) * ENERGY_STEP;
  return step > before && step > 0 ? step : null;
}

/** Returns newly crossed belt levels and the highest crossed Energy tenth; decreases reach nothing. */
export function getReached({
  brainPower,
  energy,
}: {
  brainPower: Change;
  energy: Change;
}): Reached {
  return { energy: getEnergyReached(energy), level: getLevelReached(brainPower) };
}
