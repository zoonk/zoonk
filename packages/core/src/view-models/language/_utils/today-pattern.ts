import { type Goal } from "@zoonk/db";
import { findFreshMistakePattern } from "../../../language/patterns/find-fresh-pattern";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import { findSavedDaySession } from "../../../sessions/_utils/saved-day-session";
import { isFullMeal } from "../../../sessions/missions";
import { readMissionDocument } from "../../../sessions/missions/catalog";
import { getDayMissions, hasDayMissionBonus } from "../../../sessions/missions/get-day-missions";

/** The Today view owns the prompt: a drill already offered as today's mission needs one entry. */
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

  // The card replaces its unfinished rows with an earned-elsewhere line. Keep the drill's
  // separate entry in that state; otherwise suppression would remove its only Today entry.
  return earned && !isFullMeal(missions) ? pattern : null;
}
