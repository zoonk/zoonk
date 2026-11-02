import "server-only";
import { type GoalKind } from "@zoonk/db";
import { type OwnedGoal } from "../../../learner/_utils/owned-goal";
import { getCurrentMemoryInsight } from "../../../memory/insights/get-current-memory-insight";
import { loadOwnedGoalPreparation } from "../../../preparation/_utils/load-goal-preparation";
import { getGoalPreparation } from "../../../preparation/get-goal-preparation";
import { getRequestProgressDateContext } from "../../../progress/get-request-date-context";
import { type ReadStudyDay } from "../../../sessions/_utils/read-study-day";
import { getSelectedCatchUpItems } from "../../../sessions/_utils/selected-day-plan";
import { type DayView } from "../../../sessions/day-view";
import { loadGoalLessons } from "../../syllabus/_utils/load-goal-lessons";
import { getSyllabusView } from "../../syllabus/get-syllabus-view";
import { readTodayWeeklyChallenge } from "./weekly-challenge-view";

async function loadLessons({
  goalId,
  kind,
  selection,
}: {
  goalId: string;
  kind: GoalKind;
  selection: ReadStudyDay["selection"];
}) {
  if (kind === "exam" || kind === "explain") {
    return null;
  }

  if (selection) {
    const lessons = await loadGoalLessons(goalId, selection.context);
    return lessons ? { done: lessons.done, total: lessons.total } : null;
  }

  const result = await getSyllabusView({ goalId });

  if (result.status !== "ready") {
    return null;
  }

  const { done, total } = result.syllabus.lessons;
  return { done, total };
}

/** All surrounding cards must use the session's goal. */
export async function loadAroundSession({
  owned,
  timeZone,
  session,
  selection,
}: {
  owned: Extract<OwnedGoal, { status: "ready" }>;
  timeZone?: string;
  session: DayView;
  selection: ReadStudyDay["selection"];
}) {
  const { id: goalId, kind } = owned.goal;

  const [preparation, lessons, insight, challenge] = await Promise.all([
    selection
      ? getRequestProgressDateContext().then((dateContext) =>
          loadOwnedGoalPreparation({
            dateContext,
            owned,
            selectedPlan: {
              ...selection.context,
              ...(selection.left.length > 0 && {
                catchUp: getSelectedCatchUpItems(selection).length,
              }),
            },
          }),
        )
      : getGoalPreparation(goalId),
    loadLessons({ goalId, kind, selection }),
    getCurrentMemoryInsight({ goalId }),
    readTodayWeeklyChallenge({ goalId, selection, session, timeZone }),
  ]);

  return { challenge, insight, lessons, preparation };
}
