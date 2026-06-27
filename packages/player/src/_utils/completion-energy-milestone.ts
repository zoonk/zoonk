import { clampEnergy } from "@zoonk/utils/energy";
import { type CompletionProgress, type PlayerProgressSnapshot } from "../completion-milestones";
import {
  getReachedEnergyThreshold,
  hasCompletedNewFullEnergyDay,
  isFullEnergyDayMilestone,
} from "./completion-milestone-thresholds";

export type EnergyCompletionMilestone =
  | { energy: number; kind: "energy"; status: "threshold" }
  | { days: number; kind: "energy"; status: "fullDays" };

/**
 * Computes the post-completion Energy from the server snapshot and the same
 * lesson score used by the completion summary. The server writes the same
 * clamped value later, so the milestone preview matches persisted progress.
 */
function getNewEnergy({
  completion,
  progressSnapshot,
}: {
  completion: CompletionProgress;
  progressSnapshot: PlayerProgressSnapshot;
}) {
  return clampEnergy(progressSnapshot.currentEnergy + completion.energyDelta);
}

/**
 * Builds the 10-point Energy milestone when this completion moves the learner
 * into a new visible Energy band.
 */
export function getEnergyThresholdMilestone({
  completion,
  progressSnapshot,
}: {
  completion: CompletionProgress;
  progressSnapshot: PlayerProgressSnapshot | null;
}): EnergyCompletionMilestone | null {
  if (!progressSnapshot) {
    return null;
  }

  const newEnergy = getNewEnergy({ completion, progressSnapshot });

  const energy = getReachedEnergyThreshold({
    newEnergy,
    previousEnergy: progressSnapshot.currentEnergy,
  });

  if (energy === null) {
    return null;
  }

  return { energy, kind: "energy", status: "threshold" };
}

/**
 * Builds the full-energy-day milestone from the pre-completion count plus
 * today's possible first 100% Energy finish.
 */
export function getFullEnergyDaysMilestone({
  completion,
  progressSnapshot,
}: {
  completion: CompletionProgress;
  progressSnapshot: PlayerProgressSnapshot | null;
}): EnergyCompletionMilestone | null {
  if (!progressSnapshot) {
    return null;
  }

  const newEnergy = getNewEnergy({ completion, progressSnapshot });

  const completedFullEnergyDay = hasCompletedNewFullEnergyDay({
    newEnergy,
    todayEnergyAtEnd: progressSnapshot.todayEnergyAtEnd,
  });

  const newFullEnergyDays = progressSnapshot.fullEnergyDays + (completedFullEnergyDay ? 1 : 0);

  if (!completedFullEnergyDay || !isFullEnergyDayMilestone(newFullEnergyDays)) {
    return null;
  }

  return { days: newFullEnergyDays, kind: "energy", status: "fullDays" };
}
