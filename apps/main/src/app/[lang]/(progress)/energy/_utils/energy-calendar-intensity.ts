const ENERGY_INTENSITY_STEP = 25;
const MAXIMUM_ENERGY = 100;
const MAXIMUM_ENERGY_INTENSITY = 5;

/**
 * Energy has an absolute 0% to 100% meaning, so fixed 25-point bands preserve
 * the same color meaning for every learner while the strongest band remains
 * exclusive to maximum Energy.
 */
export function getEnergyCalendarIntensity(energy: number | null): number {
  if (energy === null || energy <= 0) {
    return 0;
  }

  return energy >= MAXIMUM_ENERGY
    ? MAXIMUM_ENERGY_INTENSITY
    : Math.ceil(energy / ENERGY_INTENSITY_STEP);
}
