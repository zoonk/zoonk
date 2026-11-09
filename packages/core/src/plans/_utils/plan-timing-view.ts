import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type PlanDayView, type PlanView } from "../plan-view-contract";
import { type StudyCalendar } from "../planner/plan-calendar";
import { getExamDayRules } from "../planner/plan-days";
import { type SkillAreas } from "./plan-phase-views";
import { type PlanReadContext } from "./plan-read-projection";
import { buildFundedMocksView, buildNextDaysView, buildWeekView } from "./plan-week-view";

export function buildPlanTimingView({
  access,
  calendar,
  context,
  skillAreas,
  studiedDates,
}: {
  access: PlanView["access"];
  calendar: StudyCalendar;
  context: PlanReadContext;
  skillAreas: SkillAreas;
  studiedDates: ReadonlySet<string>;
}): Pick<PlanView, "fundedMocks" | "week"> & { nextDays: PlanDayView[] } {
  const { goal, items, state, today } = context;

  const days = {
    access,
    calendar,
    exam: getExamDayRules({ isExam: goal.kind === "exam", settings: state.settings }),
    items,
    overflow: state.settings.checkpointOverflow,
    skillAreas,
    startDate: getDateInTimeZone({ date: goal.createdAt, timeZone: context.timeZone }),
    studiedDates,
    targetDate: goal.targetDate,
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
    nextDays: buildNextDaysView(days),
    week: buildWeekView(days),
  };
}
