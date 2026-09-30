import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getDayBeforePlan, loadShortPlanDay } from "../../plans/_utils/load-short-plan-day";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { getExamCalendar, toExamDates } from "../_utils/exam-calendar";
import { getExamDayChecklist, getExamStage } from "../final-stretch/final-stretch-rules";
import { loadFinalStretchStart } from "../final-stretch/load-final-stretch-start";
import { type ExamMomentView } from "./exam-view-contract";

const CHECKLIST_STAGES = new Set<ExamMomentView["stage"]>(["dayBefore", "examDay"]);

/** The exam day Today talks about: the next one ahead, or the last one once they're over. */
function pickDay({
  days,
  today,
}: {
  days: ReturnType<typeof getExamCalendar>["days"];
  today: Date;
}) {
  const todayIso = toIsoDate(today);
  return days.find((day) => day.date >= todayIso) ?? days.at(-1) ?? null;
}

/**
 * The exam's moment on Today for an exam goal, when there's one to show: the final stretch, the
 * light day before, the exam day, and after the exam, "How did it go?" until the official result
 * is in. Internal: Today's view model reads it for the learner's own goal.
 */
export async function loadExamMoment({
  goal,
  today,
}: {
  goal: Pick<
    Goal,
    | "createdAt"
    | "details"
    | "examBlueprintId"
    | "id"
    | "kind"
    | "targetDate"
    | "timezone"
    | "title"
  >;
  /** The session's learner-local date, as a UTC-midnight label. */
  today: Date;
}): Promise<ExamMomentView | null> {
  if (goal.kind !== "exam") {
    return null;
  }

  const [blueprint, finalStretchStart] = await Promise.all([
    goal.examBlueprintId
      ? prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
      : null,
    loadFinalStretchStart(goal.id),
  ]);

  const calendar = getExamCalendar({ blueprint, goal });
  const stage = getExamStage({ examDays: toExamDates(calendar), finalStretchStart, today });

  if (stage === "preparing") {
    return null;
  }

  const [sessionsDone, mocksTaken, result, shortPlan] = await Promise.all([
    prisma.studySession.count({ where: { goalId: goal.id, startedAt: { not: null } } }),
    prisma.mockExam.count({ where: { goalId: goal.id, status: "finished" } }),
    prisma.examResult.findUnique({ select: { id: true }, where: { goalId: goal.id } }),
    loadShortPlanDay({ goal, today }),
  ]);

  return {
    checklist: CHECKLIST_STAGES.has(stage) ? getExamDayChecklist(blueprint) : [],
    day: pickDay({ days: calendar.days, today }),
    dayBefore: getDayBeforePlan({ shortPlan, today }),
    examName: blueprint?.name ?? goal.title,
    mocksTaken,
    resultReported: result !== null,
    sessionsDone,
    stage,
    timeZone: calendar.timeZone,
  };
}
