import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readPlannedDay } from "../../learner/facts/planned-day";
import { readPracticeMistakes } from "../../learner/facts/practice-mistakes";
import { readPreparationInputs } from "../../learner/facts/preparation-inputs";
import { readActiveSubscription } from "../../learner/facts/subscription";
import { readTodayPlanSession } from "../../learner/facts/today-plan-session";
import { readUsageTotals } from "../../learner/facts/usage-totals";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
import { type DayView } from "../day-view";
import { loadUnstartedDayView } from "./load-unstarted-day";
import { planStudyDay, toUnstartedBlocks } from "./plan-study-day";
import { readSavedDayView } from "./read-saved-day-view";
import { type SelectedDayPlan } from "./selected-day-plan";
import { type SessionDayContext } from "./session-placement";

export type ReadStudyDay = {
  /** The goal's exam blueprint, read once for the day and whatever else the request shows. */
  blueprint: ExamBlueprint | null;
  selection: SelectedDayPlan | null;
  session: DayView;
  timeZone: string;
};

/** The blocks Today shows before Start builds the day; the Plan and the challenge screen read today from them. */
export async function previewTodayBlocks(userId: string, goalId: string, timeZone: string) {
  const planned = await readPlannedDay(userId, goalId, timeZone);
  return toUnstartedBlocks(planned?.day.blocks ?? []);
}

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
    readTodayPlanSession(userId, goal.id, timeZone),
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

  const preview = await readPlannedDay(userId, goal.id, timeZone);

  if (!preview) {
    return null;
  }

  const { day: plannedDay, selection } = preview;

  const context: SessionDayContext = {
    blueprint,
    goal,
    localDate,
    now,
    readSubscription: readActiveSubscription,
    timeZone,
    userId,
  };

  const day = await planStudyDay({
    ...context,
    plannedDay,
    readMistakes: () => readPracticeMistakes(userId, goal.id),
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
