import { findFinishByCapacity } from "../planner/daily-need";
import { addDays, fromIsoDate, getWeeklyEventWeekday, toIsoDate } from "../planner/plan-calendar";
import { createLearnDays } from "../planner/plan-days";
import { LEARN_KINDS } from "../planner/plan-item-rules";
import { getCalendar, getPlanStart } from "../planner/plan-run-days";
import { getLessonCapacity } from "../planner/schedule-units";
import { getDatedFinish, getSavedCourseFinish } from "./course-finish";
import { type PlanReadContext, type PlanReadItem } from "./plan-read-projection";
import { type PlanSummary } from "./plan-summary";
import { readSelectedItemFacts } from "./selected-item-contract";

function getMissedMinutes({
  item,
  layoutDay,
  today,
}: {
  item: PlanReadItem;
  layoutDay: string;
  today: string;
}): number {
  if (!LEARN_KINDS.has(item.kind) || !item.scheduledFor || item.status !== "todo") {
    return 0;
  }

  const facts = readSelectedItemFacts(item.facts);

  const days = facts?.days ?? [
    [
      toIsoDate(item.scheduledFor),
      item.minutes ?? 0,
      facts ? facts.parts.written + facts.parts.unwritten : (item.minutes ?? 0),
    ] as const,
  ];

  return days.reduce((sum, [day, , raw]) => (day >= layoutDay && day < today ? sum + raw : sum), 0);
}

export function readSavedCourseForecast({
  context,
  summary,
}: {
  context: Pick<PlanReadContext, "items" | "phases" | "today"> & {
    goal: Pick<PlanReadContext["goal"], "dailyMinutes" | "kind" | "targetDate">;
    state: Pick<PlanReadContext["state"], "settings">;
  };
  summary: PlanSummary | null;
}) {
  const { goal, items, phases, today } = context;
  const finish = !goal.targetDate && summary ? getSavedCourseFinish(summary) : null;
  const day = toIsoDate(today);
  const layoutDay = summary?.basis.layoutStudyDay;

  if (goal.targetDate || !layoutDay || layoutDay >= day || goal.kind === "exam") {
    return { finish, phases };
  }

  const byPhase = new Map<number, number>();

  for (const item of items) {
    const missed = getMissedMinutes({ item, layoutDay, today: day });

    if (missed > 0) {
      byPhase.set(item.phase, (byPhase.get(item.phase) ?? 0) + missed);
    }
  }

  if (byPhase.size === 0) {
    return { finish: finish?.date ? getDatedFinish({ date: finish.date, today }) : finish, phases };
  }

  const input = { goal, settings: context.state.settings, today };
  const calendar = getCalendar(input);

  const describeDay = createLearnDays({
    calendar,
    eventWeekday: getWeeklyEventWeekday(calendar),
    practiceBias: input.settings.practiceBias,
    start: getPlanStart(input),
    targetDate: null,
  });

  const move = (date: string, remaining: number) =>
    remaining > 0
      ? findFinishByCapacity({
          capacityAt: (when) => getLessonCapacity({ date: when, shape: describeDay(when) }),
          remaining,
          start: date < day ? today : addDays(fromIsoDate(date), 1),
          today,
        })
      : getDatedFinish({ date, today });

  const missed = { total: 0 };

  const movedPhases = phases.map((phase, index) => {
    const startDate =
      phase.startDate && phase.startDate > day
        ? move(phase.startDate, missed.total).date
        : phase.startDate;

    missed.total += byPhase.get(index) ?? 0;
    const endDate = phase.endDate ? move(phase.endDate, missed.total).date : null;

    return {
      ...phase,
      endDate,
      ...(phase.endDate && !endDate && { later: true as const }),
      startDate,
    };
  });

  return { finish: finish?.date ? move(finish.date, missed.total) : finish, phases: movedPhases };
}
