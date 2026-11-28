import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getNamedMonthStart } from "../../exams/_utils/exam-edition-days";
import { getExamCalendarDay, getPlanExamDays } from "../../exams/_utils/plan-exam-days";
import { getKeptMonthStart } from "../../exams/kept-month";
import { isBookedExam, isCourseDateSkipped } from "../../view-models/onboarding/onboarding-steps";
import { toIsoDate } from "../planner/plan-calendar";
import { getTargetDateBounds } from "../target-date-range";

type ExamTarget = { asksNotice: boolean; noticeDate: string | null; targetDate: string | null };

export async function getExamTarget({
  followNotice,
  goal,
  noticeDate,
  today,
}: {
  followNotice: boolean;
  goal: Goal;
  noticeDate: string | null;
  today: string;
}): Promise<ExamTarget> {
  const goalDate = goal.targetDate ? toIsoDate(goal.targetDate) : null;
  const kept = { asksNotice: false, noticeDate, targetDate: goalDate };

  if (
    isCourseDateSkipped({
      details: isJsonObject(goal.details) ? goal.details : {},
      targetDate: goalDate,
    })
  ) {
    return { asksNotice: false, noticeDate: null, targetDate: null };
  }

  if (isBookedExam({ details: isJsonObject(goal.details) ? goal.details : {}, kind: goal.kind })) {
    return { asksNotice: false, noticeDate: null, targetDate: goalDate };
  }

  if (goalDate && !(followNotice && goalDate === noticeDate)) {
    return kept;
  }

  if (goal.kind !== "exam") {
    return kept;
  }

  const noticeDay = await findNoticeNextDay({ goal, goalDate });
  const keptMonth = getKeptMonthStart({ details: goal.details, noticeDay, today });
  const latest = getTargetDateBounds(today).max;

  if (keptMonth) {
    return keptMonth <= latest
      ? { asksNotice: true, noticeDate: null, targetDate: keptMonth }
      : kept;
  }

  const next = noticeDay ?? getNamedMonthStart({ details: goal.details, from: today });
  return next && next <= latest ? { asksNotice: false, noticeDate: next, targetDate: next } : kept;
}

async function findNoticeNextDay({
  goal,
  goalDate,
}: {
  goal: Goal;
  goalDate: string | null;
}): Promise<string | null> {
  if (!goal.examBlueprintId) {
    return null;
  }

  const blueprint = await prisma.examBlueprint.findUnique({
    select: { edition: true },
    where: { id: goal.examBlueprintId },
  });

  return (
    getPlanExamDays({
      details: goal.details,
      edition: blueprint?.edition,
      goalDate,
      today: getExamCalendarDay({ edition: blueprint?.edition, now: new Date() }).today,
    }).days[0]?.date ?? null
  );
}
