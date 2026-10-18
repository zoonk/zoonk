import { type MissionMomentView } from "../completion-contract";

/**
 * Several activities' moments as one, in the order they happened: every mission they completed,
 * and the day as the one that paid its bonus left it (every mission was done by then), else as the
 * last one did. Null when none has one.
 */
export function joinMissionMoments(
  moments: readonly (MissionMomentView | null)[],
): MissionMomentView | null {
  const kept = moments.filter((moment) => moment !== null);
  const last = kept.at(-1);

  if (!last) {
    return null;
  }

  const { fullMeal, missions } = kept.find((moment) => moment.fullMeal.paid) ?? last;

  return {
    completed: [...new Set(kept.flatMap((moment) => moment.completed))],
    fullMeal,
    missions,
  };
}
