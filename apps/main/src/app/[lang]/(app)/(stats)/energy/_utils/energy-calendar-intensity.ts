import { MAX_ENERGY } from "@zoonk/core/progress/energy";

const ENERGY_INTENSITY_STEP = 25;
const MAXIMUM_ENERGY_INTENSITY = 5;

/** Energy's 0–100% is absolute, so its bands are fixed for every learner; the strongest is full Energy alone. */
export function getEnergyCalendarIntensity(energy: number | null): number {
  if (energy === null || energy <= 0) {
    return 0;
  }

  return energy >= MAX_ENERGY
    ? MAXIMUM_ENERGY_INTENSITY
    : Math.ceil(energy / ENERGY_INTENSITY_STEP);
}
