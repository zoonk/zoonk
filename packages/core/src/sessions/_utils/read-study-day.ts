import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readExamBlueprint } from "../../learner/facts/exam-blueprint";
import { type DayView } from "../day-view";
import { loadUnstartedDayView } from "./load-unstarted-day";
import { planStudyDay } from "./plan-study-day";
import { readSavedDayView } from "./read-saved-day-view";
import { findSavedDaySession } from "./saved-day-session";
import { type SelectedDayPlan, readSavedDayPlan } from "./selected-day-plan";

export type ReadStudyDay = {
  /** The goal's exam blueprint, read once for the day and whatever else the request shows. */
  blueprint: ExamBlueprint | null;
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

  const [saved, blueprint] = await Promise.all([
    findSavedDaySession({ goalId: goal.id, now, timeZone, userId }),
    goal.examBlueprintId ? readExamBlueprint(goal.examBlueprintId) : null,
  ]);

  if (saved) {
    return {
      blueprint,
      selection: null,
      session: await readSavedDayView({
        blueprint,
        session: saved,
        timeZone,
        userId,
        weekDate: localDate,
      }),
      timeZone,
    };
  }

  const selection = await readSavedDayPlan({ goal, now, timeZone });

  if (!selection) {
    return null;
  }

  const context = { blueprint, goal, localDate, now, timeZone, userId };
  const day = await planStudyDay({ ...context, selection });

  return {
    blueprint,
    selection,
    session: await loadUnstartedDayView({ context, day, selection }),
    timeZone,
  };
}
