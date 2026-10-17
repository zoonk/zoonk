import { BRAIN_POWER_BONUS } from "./brain-power";
import { type DayBlockRef } from "./day-block";
import { type MissionDetail, type MissionKind, type MissionOpens } from "./missions/catalog";

/**
 * Today's achievable missions: finish the planned reviews, finish one new lesson, or fix a ready
 * mistake. Only available kinds are offered. Finishing all offered missions pays +50 Brain Power,
 * whether one, two or three were possible; an empty day offers no bonus.
 */

/**
 * `nothingToday` remains in the transport type for older clients; current mission selection never
 * returns it. Unavailable kinds are omitted rather than presented as work the learner cannot do.
 */
type MissionStatus = "done" | "nothingToday" | "todo";

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

export type MissionInput = {
  /** Mistakes from earlier days the learner could fix today, and how many they fixed today. */
  fix: { available: boolean; fixedToday: number };
  /** New lessons in today's session and how many were finished. */
  learn: { completed: number; lessons: number };
  /** Review blocks in today's session and how many were finished. */
  review: { blocks: number; completed: number };
};

function toMission({
  done,
  kind,
  total,
}: {
  done: number;
  kind: MissionKind;
  total: number;
}): Mission | null {
  if (total === 0) {
    return null;
  }

  return { done: Math.min(done, total), kind, status: done >= total ? "done" : "todo", total };
}

export function getMissions({ fix, learn, review }: MissionInput): Mission[] {
  const fixTotal = fix.available || fix.fixedToday > 0 ? 1 : 0;

  return [
    toMission({ done: review.completed, kind: "review", total: review.blocks }),
    // Finishing one new lesson feeds the mission; later lessons are more of the same meal.
    toMission({ done: learn.completed, kind: "somethingNew", total: Math.min(1, learn.lessons) }),
    toMission({ done: fix.fixedToday, kind: "fixMistake", total: fixTotal }),
  ].filter((mission) => mission !== null);
}

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
