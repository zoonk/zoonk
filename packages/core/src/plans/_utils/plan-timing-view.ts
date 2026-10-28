import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type PlanView } from "../plan-view-contract";
import { type StudyCalendar } from "../planner/plan-calendar";
import { getExamDayRules } from "../planner/plan-days";
import { type SkillAreas } from "./plan-phase-views";
import { type PlanReadContext } from "./plan-read-projection";
import { buildFundedMocksView, buildWeekView } from "./plan-week-view";

/** The saved calendar and mock ledger behind both the week's days and announced funded events. */
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
}): Pick<PlanView, "fundedMocks" | "week"> {
  const { goal, items, state, today } = context;

  return {
    fundedMocks: buildFundedMocksView({
      access,
      funding: goal.kind === "exam" ? state.settings.mockFunding : [],
      items,
      skillAreas,
      today,
    }),
    week: buildWeekView({
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
    }),
  };
}
