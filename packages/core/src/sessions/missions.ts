import { BRAIN_POWER_BONUS } from "./brain-power";
import { type DayBlockRef } from "./day-block";
import { type MissionDetail, type MissionKind, type MissionOpens } from "./missions/catalog";

type MissionStatus = "done" | "todo";

export type Mission = {
  done: number;
  kind: MissionKind;
  status: MissionStatus;
  total: number;
  opens?: MissionOpens;
  detail?: MissionDetail;
  firstStep?: boolean;
  /** Estimated remaining minutes; absent after completion. */
  minutes?: number;
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

export function countDoneMissions(missions: readonly Pick<Mission, "status">[]): number {
  return missions.filter((mission) => mission.status === "done").length;
}

export function countMissions(
  missions: readonly Pick<Mission, "status">[],
): { done: number; total: number } | null {
  return missions.length > 0 ? { done: countDoneMissions(missions), total: missions.length } : null;
}

/** Every offered mission actually done; a day with none never earns the completion bonus. */
export function isFullMeal(missions: readonly Pick<Mission, "status">[]): boolean {
  return missions.length > 0 && countDoneMissions(missions) === missions.length;
}
