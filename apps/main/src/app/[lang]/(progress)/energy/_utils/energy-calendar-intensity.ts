const ENERGY_INTENSITY_STEP = 25;
const MAXIMUM_ENERGY_INTENSITY = 4;

/**
 * Energy has an absolute 0% to 100% meaning, so fixed 25-point bands preserve
 * the same color meaning for every learner instead of normalizing to their max.
 */
export function getEnergyCalendarIntensity(energy: number | null): number {
  if (energy === null || energy <= 0) {
    return 0;
  }

  return Math.min(MAXIMUM_ENERGY_INTENSITY, Math.ceil(energy / ENERGY_INTENSITY_STEP));
}
