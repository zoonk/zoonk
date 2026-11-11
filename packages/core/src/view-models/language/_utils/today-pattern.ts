import { type Goal } from "@zoonk/db";
import { findFreshMistakePattern } from "../../../language/patterns/find-fresh-pattern";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import { findSavedDaySession } from "../../../sessions/_utils/saved-day-session";
import { type DayView } from "../../../sessions/day-view";
import { readMissionDocument } from "../../../sessions/missions/catalog";

/** Composes the already-read day; a drill its missions already offer gets no second entry. */
export function selectDayPattern<Pattern extends { id: string }>({
  day,
  pattern,
}: {
  day: Pick<DayView, "missions">;
  pattern: Pattern | null;
}): Pattern | null {
  if (!pattern) {
    return null;
  }

  const covered = day.missions.some(
    (mission) => mission.opens?.kind === "pattern" && mission.opens.patternId === pattern.id,
  );

  return covered ? null : pattern;
}
export async function loadNoticedPattern({ goal, userId }: { goal: Goal; userId: string }) {
  if (goal.kind !== "language" || !goal.targetLanguage) {
    return null;
  }

  return findFreshMistakePattern({ goalId: goal.id, language: goal.targetLanguage, userId });
}

/** Read-only; composes the saved day's missions without building it. */
export async function loadTodayPattern({ goal, userId }: { goal: Goal; userId: string }) {
  const pattern = await findFreshMistakePattern({
    goalId: goal.id,
    language: goal.targetLanguage ?? "",
    userId,
  });

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

  return covered ? null : pattern;
}
