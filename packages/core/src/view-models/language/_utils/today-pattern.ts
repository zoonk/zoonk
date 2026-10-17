import { type Goal } from "@zoonk/db";
import { findFreshMistakePattern } from "../../../language/patterns/find-fresh-pattern";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import { findSavedDaySession } from "../../../sessions/_utils/saved-day-session";
import { type DayView } from "../../../sessions/day-view";
import { type Mission, isFullMeal } from "../../../sessions/missions";
import { readMissionDocument } from "../../../sessions/missions/catalog";
import { getDayMissions, hasDayMissionBonus } from "../../../sessions/missions/get-day-missions";

/**
 * Whether Today keeps its pattern card beside a day whose missions offer the same drill
 * (`covered`): the drill needs one entry, so the card steps aside. Unless the bonus was earned
 * elsewhere and the day isn't a full meal: the missions card then shows an earned-elsewhere line
 * instead of its unfinished rows, and hiding the card would remove the drill's only Today entry.
 */
function keepsTodayPattern({
  covered,
  earned,
  missions,
}: {
  covered: boolean;
  earned: boolean;
  missions: readonly Pick<Mission, "status">[];
}): boolean {
  return !covered || (earned && !isFullMeal(missions));
}

/**
 * The noticed pattern Today offers beside its day: one of the day's missions may already be its
 * drill, a saved day's or an unopened day's alike, and then the card steps aside unless
 * `keepsTodayPattern` keeps it. It composes the day Today already read, so nothing is read twice.
 */
export function selectDayPattern<Pattern extends { id: string }>({
  day,
  pattern,
}: {
  day: Pick<DayView, "fullMeal" | "missions">;
  pattern: Pattern | null;
}): Pattern | null {
  if (!pattern) {
    return null;
  }

  const covered = day.missions.some(
    (mission) => mission.opens?.kind === "pattern" && mission.opens.patternId === pattern.id,
  );

  return keepsTodayPattern({ covered, earned: day.fullMeal.earned, missions: day.missions })
    ? pattern
    : null;
}

/** The pattern noticed in a language goal's recent mistakes, for Today to offer; none otherwise. */
export async function loadNoticedPattern({ goal, userId }: { goal: Goal; userId: string }) {
  if (goal.kind !== "language" || !goal.targetLanguage) {
    return null;
  }

  return findFreshMistakePattern({ language: goal.targetLanguage, userId });
}

/**
 * The notebook's pattern prompt beside a SAVED day, which it doesn't build: a drill already offered
 * as one of that day's missions needs one entry (`keepsTodayPattern`).
 */
export async function loadTodayPattern({ goal, userId }: { goal: Goal; userId: string }) {
  const pattern = await findFreshMistakePattern({ language: goal.targetLanguage ?? "", userId });

  if (!pattern || goal.status !== "active") {
    return pattern;
  }

  const now = new Date();
  const timeZone = getAnswerTimeZone({ goal });
  const session = await findSavedDaySession({ goalId: goal.id, now, timeZone, userId });

  if (!session) {
    return pattern;
  }

  const covered = readMissionDocument(session.missions)?.picks.some(
    (pick) => pick.kind === "pattern" && pick.anchor.patternId === pattern.id,
  );

  if (!covered) {
    return pattern;
  }

  const [missions, earned] = await Promise.all([
    getDayMissions({ session, timeZone }),
    hasDayMissionBonus({ now, session, timeZone }),
  ]);

  return keepsTodayPattern({ covered, earned, missions }) ? pattern : null;
}
