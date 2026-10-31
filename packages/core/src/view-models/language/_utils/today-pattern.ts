import { type Goal } from "@zoonk/db";
import { findFreshMistakePattern } from "../../../language/patterns/find-fresh-pattern";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import { findSavedDaySession } from "../../../sessions/_utils/saved-day-session";
import { type DayView } from "../../../sessions/day-view";
import { type Mission, isFullMeal } from "../../../sessions/missions";
import { readMissionDocument } from "../../../sessions/missions/catalog";
import { getDayMissions, hasDayMissionBonus } from "../../../sessions/missions/get-day-missions";

/** Keep the drill card when an earned-elsewhere bonus hides unfinished missions; otherwise avoid duplicate drill entries. */
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

/** Composes the already-read day; suppresses duplicate drill entries unless mission rows are hidden. */
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

export async function loadNoticedPattern({ goal, userId }: { goal: Goal; userId: string }) {
  if (goal.kind !== "language" || !goal.targetLanguage) {
    return null;
  }

  return findFreshMistakePattern({ language: goal.targetLanguage, userId });
}

/** Read-only; composes the saved day's missions without building it. */
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
