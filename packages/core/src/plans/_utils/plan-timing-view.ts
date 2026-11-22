import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type WeekDay } from "../../sessions/daily-goal";
import { type PlanView } from "../plan-view-contract";
import { type StudyCalendar } from "../planner/plan-calendar";
import { getExamDayRules } from "../planner/plan-days";
import { type SkillAreas } from "./plan-phase-views";
import { type PlanReadContext } from "./plan-read-projection";
import { buildFundedMocksView, buildWeekView } from "./plan-week-view";

export function buildPlanTimingView({
  access,
  calendar,
  context,
  skillAreas,
  studyDays,
}: {
  access: PlanView["access"];
  calendar: StudyCalendar;
  context: PlanReadContext;
  skillAreas: SkillAreas;
  studyDays: readonly WeekDay[];
}): Pick<PlanView, "fundedMocks" | "week"> {
  const { goal, items, state, today } = context;

  const days = {
    access,
    calendar,
    exam: getExamDayRules({ isExam: goal.kind === "exam", settings: state.settings }),
    items,
    overflow: state.settings.checkpointOverflow,
    skillAreas,
    startDate: getDateInTimeZone({ date: goal.createdAt, timeZone: context.timeZone }),
    studyDays,
    targetDate: goal.targetDate,
    timeZone: context.timeZone,
    today,
  };

  return {
    fundedMocks: buildFundedMocksView({
      access,
      funding: goal.kind === "exam" ? state.settings.mockFunding : [],
      items,
      skillAreas,
      today,
    }),
    week: buildWeekView(days),
  };
}
