import { continueAfterExam } from "./after-exam";
import { getPlannedBossMinutes } from "./boss-minutes";
import { type BuildPlanInput } from "./build-plan";
import { getMockWeeks } from "./mock-days";
import { type FundedMocks, type MockFunding } from "./mock-funding";
import { type MockResolution } from "./mock-identity";
import { toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem } from "./plan-items";
import { getCalendar } from "./plan-run-days";
import { addPracticeDays } from "./practice-days";
import {
  type DroppedUnit,
  type PlanDay,
  type ScheduledEvent,
  type ScheduledUnit,
} from "./schedule-units";
import { isShortExam } from "./short-exam-plan";
import { fundSpareMocks } from "./spare-mock-funding";
import { addSpareMocks } from "./spare-mocks";

/**
 * The plan's last lesson day: what this run scheduled (`units`), what this week keeps, and where a
 * stand-in this week began ends past its day (`keptUntil`, see `layOutAfterThisWeek`). The run's
 * copies of this week's other work don't count: a career's last lessons, kept on Sunday, ended on
 * Monday in them, and the refresh took Monday's practice day out of the plan.
 */
export function getLastLessonDate({
  kept,
  keptUntil,
  units,
}: {
  kept: readonly ExistingPlanItem[];
  keptUntil: Date | null;
  units: readonly ScheduledUnit[];
}): Date | null {
  const dates = [
    ...units.flatMap((unit) => (unit.kind === "lesson" ? [unit.date.getTime()] : [])),
    ...kept.flatMap((item) =>
      item.kind === "lesson" && item.scheduledFor ? [item.scheduledFor.getTime()] : [],
    ),
    ...(keptUntil ? [keptUntil.getTime()] : []),
  ];

  return dates.length > 0 ? new Date(Math.max(...dates)) : null;
}

/**
 * The plan's dated events: with a date, every one until then and practice days after the last
 * lesson (see `addPracticeDays`), and for an exam a mock more for each spare week (see
 * `addSpareMocks`); without a date, only those up to the last unit, plus a weekly challenge the
 * learner explicitly moved beyond it. A move never cancels a challenge the learner was shown.
 */
function getPlanEvents({
  days,
  events,
  input,
  lastLessonDate,
  lastUnitDate,
  planStart,
  units = [],
}: {
  days: readonly PlanDay[];
  events: readonly ScheduledEvent[];
  input: BuildPlanInput;
  lastLessonDate: Date | null;
  /** The last thing the run scheduled, a phase checkpoint included. */
  lastUnitDate: Date | null;
  planStart: Date;
  /** What the run scheduled: a phase's challenge after the last lesson takes its day's time. */
  units?: readonly ScheduledUnit[];
}): ScheduledEvent[] {
  const { targetDate } = input.goal;

  if (!targetDate) {
    // An explicit move is kept even when its Monday is after the plan's last lesson or challenge.
    // Moving it never cancels it just because the learner completed the remaining lessons early.
    const movedTo = new Set(input.settings.movedEvents.map((move) => move.to));

    return events.filter(
      (event) =>
        (lastUnitDate && event.date <= lastUnitDate) ||
        ((event.kind === "checkpoint" || event.kind === "mock") &&
          movedTo.has(toIsoDate(event.date))),
    );
  }

  if (input.goal.kind === "exam" && isShortExam({ planStart, targetDate })) {
    return [...events];
  }

  const practice = addPracticeDays({ days, events, lastLessonDate, units });
  const mockMinutes = input.fullMockMinutes ?? input.mockMinutes;

  return input.goal.kind === "exam"
    ? addSpareMocks({
        days,
        events: practice,
        lastLessonDate,
        mockMinutes,
        moves: input.settings.movedEvents,
        targetDate,
        weeks: getMockWeeks({
          calendar: {
            dailyMinutes: input.goal.dailyMinutes,
            weekdayMinutes: input.settings.weekdayMinutes,
          },
          minutes: mockMinutes,
        }),
      })
    : practice;
}

/**
 * A plan with a date keeps its weekly checkpoints until then, and the days after its last lesson
 * are practice days, so lessons that end weeks early never leave empty weeks before the date. A
 * test days away keeps its own short plan. A landing-only run keeps the plan's own (see
 * `landedOnly`).
 */
function listRunEvents({
  afterExam,
  funded,
  keepsRest,
  resolution,
  saved,
  start,
  ...planned
}: Parameters<typeof getPlanEvents>[0] & {
  afterExam: ReturnType<typeof continueAfterExam>;
  /** The mocks the days fund (see `fundMocks`): the ones added once lessons end early are too. */
  funded: readonly MockFunding[];
  keepsRest: boolean;
  resolution: MockResolution | null;
  /** The saved mocks no earlier pass continued (see `matchSavedMocks`). */
  saved: readonly MockFunding[];
  start: Date;
}): { events: ScheduledEvent[]; funding: MockFunding[]; sourced: Set<string> } {
  if (keepsRest) {
    return { events: [], funding: [], sourced: new Set() };
  }

  return fundSpareMocks({
    clocks: planned.input.mockClocks,
    days: planned.days,
    events: [
      ...getPlanEvents(planned).filter((event) => event.date >= start),
      ...(afterExam?.events ?? []),
    ],
    funded,
    resolution,
    saved,
    start: planned.input.today,
  });
}

/**
 * What a run schedules beside its lessons: the plan's days after its exam when it goes on past it
 * (see `continueAfterExam`), and its dated events (see `listRunEvents`), each mock with its exam
 * day in turn after the one before it, and only the saved mocks no earlier one continued.
 */
export function scheduleRunEvents({
  days,
  funded,
  input,
  keepsRest,
  lastLessonDate,
  planStart,
  resolution,
  schedule,
  start,
  windows,
}: {
  days: readonly PlanDay[];
  /** The days' funded mocks (see `fundMocks`). */
  funded: FundedMocks;
  input: BuildPlanInput;
  keepsRest: boolean;
  lastLessonDate: Date | null;
  planStart: Date;
  resolution: MockResolution | null;
  schedule: { dropped: DroppedUnit[]; events: ScheduledEvent[]; units: ScheduledUnit[] };
  start: Date;
  windows: readonly unknown[];
}) {
  const unmatched = input.settings.mockFunding.filter((entry) => !funded.matched.includes(entry));

  const afterExam = continueAfterExam({
    before: schedule.units,
    bossDays: input.bossDays,
    bossMinutes: (phase) =>
      getPlannedBossMinutes({ bossMinutes: input.bossMinutes, goalKind: "exam", phase }),
    calendar: getCalendar(input),
    clocks: input.mockClocks,
    cursor: funded.funding.findLast((entry) => entry.day !== undefined)?.day,
    dropped: schedule.dropped,
    goal: input.goal,
    mockMinutes: input.mockMinutes,
    phase: windows.length,
    resolution,
    saved: unmatched,
    settings: input.settings,
    start,
  });

  const spare = listRunEvents({
    afterExam,
    days,
    events: schedule.events,
    funded: funded.funding,
    input,
    keepsRest,
    lastLessonDate,
    lastUnitDate: schedule.units.at(-1)?.date ?? null,
    planStart,
    resolution,
    saved: unmatched.filter((entry) => !afterExam?.funded.matched.includes(entry)),
    start,
    units: schedule.units,
  });

  return { afterExam, spare };
}
