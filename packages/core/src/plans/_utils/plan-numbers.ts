import { type PlanNumbers, type PlanWorkload } from "../numbers-contract";
import { type BuiltPlan } from "../planner/build-plan";
import { addDays, daysBetween, getPlanCalendar } from "../planner/plan-calendar";
import { getExamDayRules, getPlannedMinutes } from "../planner/plan-days";
import { type PlanSettings } from "../planner/plan-state";

function roundPlanMinutes(minutes: number): number {
  return Math.round(Math.max(0, minutes) * 10) / 10;
}

type ScheduledWork = Pick<BuiltPlan, "items" | "lessonRawMinutes">;

/** One workload decomposition for public estimates and the learner's actual/prospective build. */
export function getPlanWorkload({
  built,
  fromDate,
  lessonMinutes,
  paceFactor,
}: {
  built: ScheduledWork;
  fromDate?: Date;
  lessonMinutes: ReadonlyMap<string, number>;
  paceFactor: number;
}): PlanWorkload {
  const items = built.items.filter(
    (item) =>
      item.status === "todo" &&
      item.scheduledFor !== null &&
      (!fromDate || item.scheduledFor >= fromDate),
  );

  const teaching = items.filter((item) => item.kind === "lesson" || item.kind === "chapter");

  const rawMinutes = (item: (typeof items)[number]) => {
    const portions = built.lessonRawMinutes.get(item.key);

    const raw = portions
      ? [...portions.values()].reduce((sum, minutes) => sum + minutes, 0)
      : (lessonMinutes.get(item.lessonId ?? "") ?? 0) * paceFactor;

    return Math.min(item.minutes, raw);
  };

  const written = teaching
    .filter((item) => item.lessonId !== null || item.kind === "chapter")
    .reduce((sum, item) => sum + rawMinutes(item), 0);

  const unwritten = teaching
    .filter((item) => item.lessonId === null && item.kind !== "chapter")
    .reduce((sum, item) => sum + rawMinutes(item), 0);

  const lessons = teaching.reduce((sum, item) => sum + item.minutes, 0);
  const reviews = items.reduce((sum, item) => sum + (item.kind === "review" ? item.minutes : 0), 0);

  const checkpoints = items.reduce(
    (sum, item) => sum + (["boss", "checkpoint", "mock"].includes(item.kind) ? item.minutes : 0),
    0,
  );

  return {
    checkpointMinutes: roundPlanMinutes(checkpoints),
    lessonMinutes: roundPlanMinutes(written),
    practiceMinutes: roundPlanMinutes(Math.max(0, lessons - written - unwritten) + reviews),
    unwrittenLessonMinutes: roundPlanMinutes(unwritten),
  };
}

/** Uses the same daily allocation as Plan and Today; authored content does not define time. */
export function getPlanNumbers({
  built,
  coverage,
  context,
  isExam,
  settings,
  workload,
}: {
  built: Pick<BuiltPlan, "items" | "lessonDayMinutes">;
  context: PlanNumbers["context"];
  coverage: Pick<NonNullable<PlanNumbers["coverage"]>, "coveredShare" | "measure"> | null;
  isExam: boolean;
  settings: PlanSettings;
  workload: PlanWorkload;
}): PlanNumbers {
  const from = new Date(`${context.fromDate}T00:00:00Z`);
  const targetDate = context.targetDate;
  const target = targetDate ? new Date(`${targetDate}T00:00:00Z`) : null;
  const scheduledMinutes = Object.values(workload).reduce((sum, minutes) => sum + minutes, 0);

  const after =
    target && targetDate
      ? built.items.reduce((sum, item) => {
          if (item.status !== "todo" || !item.scheduledFor || item.scheduledFor < from) {
            return sum;
          }

          // A joined stand-in starts before the exam but can teach after it. Its actual day
          // portions split that time; events and rows without portions keep their dates.
          const portions = built.lessonDayMinutes.get(item.key);

          if (portions) {
            const minutes = [...portions]
              .filter(([date]) => date >= context.fromDate && date >= targetDate)
              .reduce((total, [, amount]) => total + amount, 0);

            return sum + minutes;
          }

          if (item.scheduledFor >= target) {
            return sum + item.minutes;
          }

          return sum;
        }, 0)
      : 0;

  const afterDeadlineMinutes = target ? roundPlanMinutes(after) : null;
  const calendar = getPlanCalendar({ dailyMinutes: context.dailyMinutes, settings });
  const exam = getExamDayRules({ isExam, settings });

  const dates = target
    ? Array.from({ length: Math.max(0, daysBetween(from, target)) }, (_, index) =>
        addDays(from, index),
      )
    : [];

  const budgets = dates.map((date) =>
    getPlannedMinutes({
      calendar,
      date,
      exam,
      overflow: settings.checkpointOverflow,
      targetDate: target,
    }),
  );

  const overflow = settings.checkpointOverflow
    .filter(
      (entry) =>
        entry.date >= context.fromDate &&
        context.targetDate !== null &&
        entry.date < context.targetDate,
    )
    .reduce((sum, entry) => sum + entry.minutes, 0);

  return {
    afterDeadlineMinutes,
    availableBeforeDeadlineMinutes: target
      ? roundPlanMinutes(budgets.reduce((sum, minutes) => sum + minutes, 0))
      : null,
    beforeDeadlineMinutes: target ? scheduledMinutes - (afterDeadlineMinutes ?? 0) : null,
    context,
    coverage:
      target && coverage
        ? {
            basis: "selected",
            coveredShare: Math.round(coverage.coveredShare * 100) / 100,
            measure: coverage.measure,
            scope: "selectedCurriculum",
          }
        : null,
    milestoneExtraMinutesBeforeDeadline: target ? roundPlanMinutes(overflow) : null,
    scheduledMinutes,
    studyDaysBeforeDeadline: target ? budgets.filter((minutes) => minutes > 0).length : null,
    workload,
  };
}
