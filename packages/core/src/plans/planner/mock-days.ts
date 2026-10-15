import {
  type StudyCalendar,
  addDays,
  daysBetween,
  getStudyDayMinutes,
  getStudyMinutes,
} from "./plan-calendar";
import { type ExistingPlanItem } from "./plan-items";
import { type ExamWindow, findExamWindow } from "./plan-phases";
import { MIN_DAYS_APART } from "./spare-mocks";

/**
 * When an exam plan's weekly mocks fall: the week's event day, in the foundations from the plan's
 * second week (`firstMockDay`), every week or every few when a mock is longer than the learner's
 * study day (`every`, see `getMockWeeks`), and mocks of the plan's own (`ownMockDays`) where no
 * week's day falls in time (see `getOwnMockDays`).
 */
export type MockDays = {
  eventWeekday: number;
  /** Weeks from one mock to the next: the regular weeks' and the final stretch's whole exam days. */
  every: { finalStretch: number; weekly: number };
  firstMockDay: Date;
  ownMockDays: readonly Date[];
  targetDate: Date;
};

const DAYS_PER_WEEK = 7;

/** A mock this much longer than the learner's study day still fits it: minutes don't add up exactly. */
const EPSILON = 1e-6;

/**
 * Weeks from one plan mock to the next: a mock takes the time of one study day a week, so one
 * longer than the learner's study day comes every few weeks, the time it takes set aside from the
 * days in between, instead of every week on top of them: Ana's 15 minutes a day had a mock of two
 * and a half hours every week, 44 in a year, more than all her time. Each phase still has one
 * (see `getOwnMockDays`), and the anytime mocks are there whenever she wants more.
 */
export function getMockWeeks({
  calendar,
  minutes,
}: {
  calendar: Pick<StudyCalendar, "dailyMinutes" | "weekdayMinutes">;
  minutes: number;
}): number {
  const day = getStudyDayMinutes(calendar);
  return day > 0 ? Math.max(1, Math.ceil(minutes / day - EPSILON)) : 1;
}

/** Whether a date falls on a week of the plan's mocks (see `MockDays.every`). */
export function isMockWeek({
  date,
  every,
  firstMockDay,
}: {
  date: Date;
  every: number;
  firstMockDay: Date;
}) {
  const week = Math.floor(daysBetween(firstMockDay, date) / DAYS_PER_WEEK);
  return ((week % every) + every) % every === 0;
}

/** A phase this long holds a mock: it always has a week's mock day past the plan's first week. */
const MOCK_PHASE_DAYS = 14;

/**
 * The day before the exam is light (see `isLightDayBefore`): a late mock comes before it, except a
 * class test's short mock, which may take that day's review.
 */
const LATEST_MOCK_DAYS_BEFORE = 2;

/** The days of the plan's mocks the learner took. */
export function listTakenMockDays(items: readonly ExistingPlanItem[]): Date[] {
  return items.flatMap((item) =>
    item.kind === "mock" && item.status !== "todo" && item.scheduledFor ? [item.scheduledFor] : [],
  );
}

/**
 * A weekly mock's day: the week's event day in every phase (the foundations' from the plan's
 * second week: the first ones say where the learner starts, so later ones show how far they came)
 * on a week of the plan's mocks (see `getMockWeeks`), never days before the exam (see
 * `MIN_DAYS_APART`), which the final stretch keeps for review.
 */
export function isMockDay({
  date,
  mockDays,
  window,
}: {
  date: Date;
  mockDays: MockDays;
  window: ExamWindow;
}): boolean {
  const every =
    window.kind === "finalStretch" ? mockDays.every.finalStretch : mockDays.every.weekly;

  return (
    mockDays.ownMockDays.some((day) => day.getTime() === date.getTime()) ||
    ((window.kind !== "foundations" || date >= mockDays.firstMockDay) &&
      date.getUTCDay() === mockDays.eventWeekday &&
      isMockWeek({ date, every, firstMockDay: mockDays.firstMockDay }) &&
      daysBetween(date, mockDays.targetDate) >= MIN_DAYS_APART)
  );
}

/** The days from `start` to `end`, both included; none when `end` comes first. */
function listDays(start: Date, end: Date): Date[] {
  return Array.from({ length: Math.max(0, daysBetween(start, end) + 1) }, (_, index) =>
    addDays(start, index),
  );
}

/**
 * Mocks of the plan's own, so every exam plan rehearses the exam and every phase two weeks long or
 * more does too, when the learner missed the week's mock days or none falls in time. A phase whose
 * days left from `from` (the first day a run plans) hold no week's mock day, and whose mocks the
 * learner didn't take, gets one on its last study day: Câmara's learner missed the foundations'
 * one mock, and the phase's last four days went on with none. The plan, when no mock day falls
 * between its start (or `from`) and the days before the exam it keeps for review (an exam 8 days
 * away had its one Sunday 2 days before it), gets one on the last study day before those days; a
 * learner back only in those days (a class test's learner missed the days its one mock was on and
 * came back two days before) gets it on the first study day they have, the day before the exam
 * kept light unless the exam is a class test (`shortMockMinutes`): its learner, back on the day
 * before after missing the mock on the day they came back, still rehearses then. A class test's
 * own mock goes on that day before whenever it's a study day, beside its review, so it never takes
 * a lesson day: a focus planned a missed one again on the last lesson day, and its 30 minutes on a
 * 15-minute day pushed the rest of the chapter in progress out. None once the learner took one of
 * the plan's mocks.
 */
function getOwnMockDays({
  calendar,
  from,
  mockDays,
  shortMockMinutes,
  takenMocks = [],
  windows,
}: {
  calendar: StudyCalendar;
  from?: Date;
  mockDays: Omit<MockDays, "ownMockDays">;
  shortMockMinutes: number | null;
  takenMocks?: readonly Date[];
  windows: readonly ExamWindow[];
}): Date[] {
  const start = windows[0]?.startDate;

  if (!start) {
    return [];
  }

  const first = from && from > start ? from : start;
  const last = addDays(mockDays.targetDate, -MIN_DAYS_APART);
  const weekly = { ...mockDays, ownMockDays: [] };
  const isStudyDay = (date: Date) => getStudyMinutes({ calendar, date }) > 0;

  const isWeeklyDay = (date: Date) => {
    const window = findExamWindow({ date, windows });
    return Boolean(window && isMockDay({ date, mockDays: weekly, window }));
  };

  const phaseMocks = windows.flatMap((window) => {
    const long = daysBetween(window.startDate, window.endDate) + 1 >= MOCK_PHASE_DAYS;
    const taken = takenMocks.some((day) => window.startDate <= day && day <= window.endDate);
    const left = listDays(first > window.startDate ? first : window.startDate, window.endDate);
    const days = left.filter((date) => date <= last);

    if (!long || taken || days.some((date) => isWeeklyDay(date))) {
      return [];
    }

    return days.findLast((date) => isStudyDay(date)) ?? [];
  });

  const days = listDays(first, last);

  if (takenMocks.length > 0 || phaseMocks.length > 0 || days.some((date) => isWeeklyDay(date))) {
    return phaseMocks;
  }

  const latest = addDays(mockDays.targetDate, shortMockMinutes ? -1 : -LATEST_MOCK_DAYS_BEFORE);
  const dayBefore = shortMockMinutes && latest >= first && isStudyDay(latest) ? latest : null;

  const own =
    dayBefore ??
    days.findLast((date) => isStudyDay(date)) ??
    listDays(first, latest).find((date) => isStudyDay(date));

  return own ? [own] : [];
}

/** An exam plan's mock days (see `MockDays`). */
export function getMockDays({
  calendar,
  from,
  mockMinutes,
  shortMockMinutes = null,
  takenMocks,
  windows,
  ...days
}: Omit<MockDays, "every" | "ownMockDays"> & {
  calendar: StudyCalendar;
  /** The first day the run plans (see `getOwnMockDays`). */
  from?: Date;
  /** How long the regular weeks' mocks and the final stretch's whole exam days take. */
  mockMinutes: { finalStretch: number; weekly: number };
  /** A class test's short mock, which may rehearse it on the day before. */
  shortMockMinutes?: number | null;
  /** The days of the plan's mocks the learner took. */
  takenMocks?: readonly Date[];
  windows: readonly ExamWindow[];
}): MockDays {
  const weekly = {
    ...days,
    every: {
      finalStretch: getMockWeeks({ calendar, minutes: mockMinutes.finalStretch }),
      weekly: getMockWeeks({ calendar, minutes: mockMinutes.weekly }),
    },
  };

  return {
    ...weekly,
    ownMockDays: getOwnMockDays({
      calendar,
      from,
      mockDays: weekly,
      shortMockMinutes,
      takenMocks,
      windows,
    }),
  };
}

/** The producer and its clock input use the same mock calendar, including the second-week start. */
export function getExamMockDays({
  fullMockMinutes,
  mockMinutes,
  ...input
}: Omit<Parameters<typeof getMockDays>[0], "firstMockDay" | "mockMinutes"> & {
  fullMockMinutes: number;
  mockMinutes: number;
}): MockDays {
  const firstDay = input.windows[0]?.startDate ?? addDays(input.targetDate, -1);

  return getMockDays({
    ...input,
    firstMockDay: addDays(firstDay, 7),
    mockMinutes: { finalStretch: fullMockMinutes, weekly: mockMinutes },
  });
}
