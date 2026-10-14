import { type Goal, prisma } from "@zoonk/db";
import { findFreshMistakePattern } from "../../../language/patterns/find-fresh-pattern";
import { resolveTodaySession } from "../../../sessions/_utils/today-session";
import { isFullMeal } from "../../../sessions/missions";
import { readMissionDocument } from "../../../sessions/missions/catalog";
import { getDayMissions, hasDayMissionBonus } from "../../../sessions/missions/get-day-missions";

/** The Today view owns the prompt: a drill already offered as today's mission needs one entry. */
export async function loadTodayPattern({ goal, userId }: { goal: Goal; userId: string }) {
  const pattern = await findFreshMistakePattern({ language: goal.targetLanguage ?? "", userId });

  if (!pattern || goal.status !== "active") {
    return pattern;
  }

  const built = await prisma.planItem.count({ where: { plan: { goalId: goal.id } } });

  if (built === 0) {
    return pattern;
  }

  // Resolve the same day as Today, including a carried session. A concurrent first read must not
  // show the suggestion simply because Today's other read hasn't saved its picks yet.
  const { session, timeZone } = await resolveTodaySession({ goal, userId });

  const covered = readMissionDocument(session.missions)?.picks.some(
    (pick) => pick.kind === "pattern" && pick.anchor.patternId === pattern.id,
  );

  if (!covered) {
    return pattern;
  }

  const [missions, earned] = await Promise.all([
    getDayMissions({ session, timeZone }),
    hasDayMissionBonus({ now: new Date(), session, timeZone }),
  ]);

  // The card replaces its unfinished rows with an earned-elsewhere line. Keep the drill's
  // separate entry in that state; otherwise suppression would remove its only Today entry.
  return earned && !isFullMeal(missions) ? pattern : null;
}
