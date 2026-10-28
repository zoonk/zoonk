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
  lastUnitDate: Date | null;
  planStart: Date;
  units?: readonly ScheduledUnit[];
}): ScheduledEvent[] {
  const { targetDate } = input.goal;

  if (!targetDate) {
    // A move the learner made is kept even past the plan's last lesson: it never cancels the
    // challenge they were shown.
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
  funded: readonly MockFunding[];
  keepsRest: boolean;
  resolution: MockResolution | null;
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
