import { BRAIN_POWER_BONUS } from "./brain-power";
import { type DayBlockRef } from "./day-block";
import { type MissionDetail, type MissionKind, type MissionOpens } from "./missions/catalog";

/**
 * Today's achievable missions: finish the planned reviews, finish one new lesson, or fix a ready
 * mistake. Only available kinds are offered. Finishing all offered missions pays +50 Brain Power,
 * whether one, two or three were possible; an empty day offers no bonus.
 */

type MissionStatus = "done" | "todo";

export type Mission = {
  done: number;
  kind: MissionKind;
  status: MissionStatus;
  total: number;
  opens?: MissionOpens;
  detail?: MissionDetail;
  firstStep?: boolean;
  /**
   * About how many minutes a mission still to do asks: its unfinished blocks' planned minutes, or
   * an estimate for work outside the day's blocks. Absent once done.
   */
  minutes?: number;
  /**
   * Why the block it opens can't start yet (`getBlockWait`): a phase's challenge waits for the
   * day's lessons before it, or for the challenge before it.
   */
  waitReason?: "challenge" | "lessons";
};

/** An unopened mission identifies actual work, never a database block that does not exist yet. */
export type DayMission = Omit<Mission, "opens"> & {
  opens?: Exclude<Mission["opens"], { kind: "block" }> | { kind: "block"; ref: DayBlockRef };
};

/** Fewer possible missions never reduce the completion bonus; no missions means no bonus. */
export function getMissionBonus(missions: readonly Pick<Mission, "status">[]): number {
  return missions.length > 0 ? BRAIN_POWER_BONUS.fullMeal : 0;
}

/** How many of the day's missions the learner actually did; one with nothing due isn't one. */
export function countDoneMissions(missions: readonly Pick<Mission, "status">[]): number {
  return missions.filter((mission) => mission.status === "done").length;
}

/** The day's missions as the buddy's tab rings them (done of offered); null on a day without any. */
export function countMissions(
  missions: readonly Pick<Mission, "status">[],
): { done: number; total: number } | null {
  return missions.length > 0 ? { done: countDoneMissions(missions), total: missions.length } : null;
}

/** Every offered mission actually done; a day with none never earns the completion bonus. */
export function isFullMeal(missions: readonly Pick<Mission, "status">[]): boolean {
  return missions.length > 0 && countDoneMissions(missions) === missions.length;
}
