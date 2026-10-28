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

export type MockDays = {
  eventWeekday: number;
  every: { finalStretch: number; weekly: number };
  firstMockDay: Date;
  ownMockDays: readonly Date[];
  targetDate: Date;
};

const DAYS_PER_WEEK = 7;

const EPSILON = 1e-6;

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

const MOCK_PHASE_DAYS = 14;

const LATEST_MOCK_DAYS_BEFORE = 2;

export function listTakenMockDays(items: readonly ExistingPlanItem[]): Date[] {
  return items.flatMap((item) =>
    item.kind === "mock" && item.status !== "todo" && item.scheduledFor ? [item.scheduledFor] : [],
  );
}

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

function listDays(start: Date, end: Date): Date[] {
  return Array.from({ length: Math.max(0, daysBetween(start, end) + 1) }, (_, index) =>
    addDays(start, index),
  );
}

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
  from?: Date;
  mockMinutes: { finalStretch: number; weekly: number };
  shortMockMinutes?: number | null;
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
