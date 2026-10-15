import "server-only";
import { type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { type DayView } from "../day-view";
import { loadUnstartedDayView } from "./load-unstarted-day";
import { planStudyDay } from "./plan-study-day";
import { readSavedDayView } from "./read-saved-day-view";
import { findSavedDaySession } from "./saved-day-session";
import { type SelectedDayPlan, selectDayPlan } from "./selected-day-plan";

export type ReadStudyDay = {
  selection: SelectedDayPlan | null;
  session: DayView;
  timeZone: string;
};

/** Reads never move a zone, settle a plan, stamp a queue or create the day's session. */
export async function readStudyDay({
  goal,
  now,
  timeZone: requestedZone,
  userId,
}: {
  goal: Goal;
  now: Date;
  timeZone?: string;
  userId: string;
}): Promise<ReadStudyDay | null> {
  const timeZone = getAnswerTimeZone({ goal, timeZone: requestedZone });
  const localDate = getDateInTimeZone({ date: now, timeZone });
  const saved = await findSavedDaySession({ goalId: goal.id, now, timeZone, userId });

  if (saved) {
    return {
      selection: null,
      session: await readSavedDayView({ session: saved, timeZone, userId, weekDate: localDate }),
      timeZone,
    };
  }

  const selection = await selectDayPlan({ goal, now, reuseReadBuild: true, timeZone });

  if (!selection) {
    return null;
  }

  const context = { goal, localDate, now, timeZone, userId };
  const day = await planStudyDay({ ...context, selection });
  return { selection, session: await loadUnstartedDayView({ context, day, selection }), timeZone };
}
