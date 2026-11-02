import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { getTodayView } from "../../view-models/today/get-today-view";
import { openStudyDay } from "../open-study-day";

/** Tests must open the day explicitly: Today GETs never create persisted ids. */
export async function openTodayView(input: { goalId: string; timeZone?: string }) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: input.goalId } });
  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });

  const opened = await openStudyDay({
    ...input,
    keepEmpty: true,
    shownDate: toIsoDate(getDateInTimeZone({ date: new Date(), timeZone })),
  });

  if (opened.status !== "opened") {
    throw new Error(`Expected the test learner's explicit open, received ${opened.status}`);
  }

  const result = await getTodayView(input);

  if (result.status !== "ready" || result.today.session.status === "unstarted") {
    throw new Error("Expected the opened day on the following read");
  }

  return { ...result, today: { ...result.today, session: result.today.session } };
}
