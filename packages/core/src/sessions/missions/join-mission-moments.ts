import { type MissionMomentView } from "../completion-contract";

/** Accepts chronological moments; retains the bonus-paying day's state, or the latest state if none paid. */
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
