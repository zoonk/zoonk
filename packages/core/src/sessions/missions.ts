/**
 * The day's three missions come from the session itself: review (open today's capsules), something
 * new (finish the new lesson) and fix a mistake. Doing all three pays a bonus, always +50 Brain
 * Power (`fullMeal` in code). They renew at the learner's local midnight because each session
 * belongs to one local day.
 */
type MissionKind = "review" | "somethingNew" | "fixMistake";

/**
 * `nothingToday` is honest: nothing was due or saved, which is a good thing, not a failure. It
 * isn't done either: only missions actually done count, and pay the bonus.
 */
type MissionStatus = "done" | "nothingToday" | "todo";

export type Mission = { done: number; kind: MissionKind; status: MissionStatus; total: number };

export type MissionInput = {
  /** Mistakes from earlier days the learner could fix today, and how many they fixed today. */
  fix: { available: boolean; fixedToday: number };
  /** New lessons in today's session and how many were finished. */
  learn: { completed: number; lessons: number };
  /** Capsules due today and how many were opened. */
  review: { capsules: number; opened: number };
};

function toMission({
  done,
  kind,
  total,
}: {
  done: number;
  kind: MissionKind;
  total: number;
}): Mission {
  if (total === 0) {
    return { done: 0, kind, status: "nothingToday", total: 0 };
  }

  return { done: Math.min(done, total), kind, status: done >= total ? "done" : "todo", total };
}

export function getMissions({ fix, learn, review }: MissionInput): Mission[] {
  const fixTotal = fix.available || fix.fixedToday > 0 ? 1 : 0;

  return [
    toMission({ done: review.opened, kind: "review", total: review.capsules }),
    // Finishing one new lesson feeds the mission; later lessons are more of the same meal.
    toMission({ done: learn.completed, kind: "somethingNew", total: Math.min(1, learn.lessons) }),
    toMission({ done: fix.fixedToday, kind: "fixMistake", total: fixTotal }),
  ];
}

/** How many of the day's missions the learner actually did; one with nothing due isn't one. */
export function countDoneMissions(missions: readonly Pick<Mission, "status">[]): number {
  return missions.filter((mission) => mission.status === "done").length;
}

/**
 * All three missions actually done, which pays the bonus. A day with nothing to review or fix
 * doesn't: Pedro's first 74-second lesson paid it, and "all three missions" wasn't true.
 */
export function isFullMeal(missions: readonly Mission[]): boolean {
  return missions.length > 0 && countDoneMissions(missions) === missions.length;
}
