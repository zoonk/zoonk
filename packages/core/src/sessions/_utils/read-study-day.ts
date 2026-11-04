import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readClaimEvents } from "../../learner/facts/claim-events";
import { readPreparationInputs } from "../../learner/facts/preparation-inputs";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { readUsageTotals } from "../../learner/facts/usage-totals";
import { toIdKey } from "../../library/_utils/shared-rows";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
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

  const savedPlan = await readSavedPlan(userId, goal.id);
  const selection = await readSavedDayPlan({ goal, now, saved: savedPlan, timeZone });

  if (!selection) {
    return null;
  }

  const context = {
    blueprint,
    goal,
    localDate,
    now,
    readClaims: (skillIds: readonly string[]) =>
      readClaimEvents(userId, goal.id, toIdKey(skillIds)),
    timeZone,
    userId,
  };

  const day = await planStudyDay({
    ...context,
    readPreparation: () => readPreparationInputs(userId, goal.id),
    readUsage: () => readUsageTotals(userId),
    selection,
  });

  return {
    blueprint,
    selection,
    session: await loadUnstartedDayView({ context, day, selection }),
    timeZone,
  };
}
