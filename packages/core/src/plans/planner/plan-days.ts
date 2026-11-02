import { getCheckpointMinutes } from "../../checkpoints/checkpoint-minutes";
import { CHECKPOINT_QUESTIONS } from "../../checkpoints/checkpoint-rules";
import { getPlannedBossMinutes } from "./boss-minutes";
import { type ExamBossDays, listBossEvents, withBossEvents } from "./exam-boss-days";
import { type MockDays, getExamMockDays, getMockWeeks, isMockDay, isMockWeek } from "./mock-days";
import { type MockFunding, getFundedMinutes } from "./mock-funding";
import {
  type StudyCalendar,
  addDays,
  daysBetween,
  fromIsoDate,
  getStudyMinutes,
  toIsoDate,
} from "./plan-calendar";
import { type ExamWindow, findExamWindow, getLearnDayShare, getLearningShare } from "./plan-phases";
import { type PlanSettings, type PracticeBias } from "./plan-state";
import { getBossKey } from "./plan-units";
import { type DayShape, type FixedEvent } from "./schedule-units";
import { getShortExamEvents, isLightDayBefore, isShortExam, mockEvent } from "./short-exam-plan";

export const WEEKLY_CHECKPOINT_MINUTES = getCheckpointMinutes(CHECKPOINT_QUESTIONS);

export const DAY_BEFORE_EXAM_MINUTES = 15;

export type ExamDayRules = {
  from?: Date;
  fullCourse?: boolean;
  mockFunding?: readonly MockFunding[];
  planStart: Date | null;
  shortMockMinutes: number | null;
  takenMocks?: readonly Date[];
};

export function getExamDayRules({
  isExam,
  settings,
}: {
  isExam: boolean;
  settings: Pick<PlanSettings, "fullCourse" | "mockFunding" | "shortMockMinutes" | "startDate">;
}): ExamDayRules | null {
  if (!isExam) {
    return null;
  }

  return {
    fullCourse: settings.fullCourse,
    mockFunding: settings.mockFunding,
    planStart: settings.startDate ? fromIsoDate(settings.startDate) : null,
    shortMockMinutes: settings.shortMockMinutes,
  };
}

const DAY_OF_SECOND_WEEK = 7;

type CalendarInput = { calendar: StudyCalendar; practiceBias: PracticeBias };

function fixedEvent(
  event: Omit<FixedEvent, "replacesDay"> & { replacesDay?: boolean },
): FixedEvent {
  return { replacesDay: false, ...event };
}

function getWeeklyEvent({ date, mockMinutes }: { date: Date; mockMinutes: number | null }) {
  if (mockMinutes !== null) {
    return mockEvent({ date, fullLength: false, minutes: mockMinutes, replacesDay: true });
  }

  return fixedEvent({
    key: `checkpoint:${toIsoDate(date)}`,
    kind: "checkpoint",
    minutes: WEEKLY_CHECKPOINT_MINUTES,
    title: "",
  });
}

export function createLearnDays({
  calendar,
  eventWeekday,
  mockMinutes = null,
  practiceBias,
  start,
  targetDate,
}: CalendarInput & {
  eventWeekday: number;
  mockMinutes?: number | null;
  start: Date;
  targetDate: Date | null;
}): (date: Date) => DayShape {
  const firstCheckpoint = addDays(start, DAY_OF_SECOND_WEEK);
  const every = mockMinutes === null ? 1 : getMockWeeks({ calendar, minutes: mockMinutes });

  return (date) => {
    const open = targetDate === null || date < targetDate;

    const isCheckpointDay =
      date >= firstCheckpoint &&
      date.getUTCDay() === eventWeekday &&
      isMockWeek({ date, every, firstMockDay: firstCheckpoint });

    return {
      events: open && isCheckpointDay ? [getWeeklyEvent({ date, mockMinutes })] : [],
      minutes: open ? getStudyMinutes({ calendar, date }) : 0,
      open,
      phase: null,
      share: getLearnDayShare({ date, hasMocks: mockMinutes !== null, practiceBias, start }),
    };
  };
}

function getPhaseCheckpointDay({
  calendar,
  mockDays,
  window,
}: {
  calendar: StudyCalendar;
  mockDays: MockDays;
  window: ExamWindow;
}): Date {
  const length = daysBetween(window.startDate, window.endDate) + 1;
  const fromEnd = Array.from({ length }, (_, index) => addDays(window.endDate, -index));

  return (
    fromEnd.find(
      (date) => getStudyMinutes({ calendar, date }) > 0 && !isMockDay({ date, mockDays, window }),
    ) ?? window.endDate
  );
}

function isPhaseCheckpointDay({
  date,
  getCheckpointDay,
  window,
}: {
  date: Date;
  getCheckpointDay: (window: ExamWindow) => Date;
  window: ExamWindow;
}): boolean {
  return window.kind !== "finalStretch" && date.getTime() === getCheckpointDay(window).getTime();
}

function getExamEvents({
  bossMinutes,
  date,
  fullMockMinutes,
  getCheckpointDay,
  isDayBefore,
  minutes,
  mockDays,
  mockMinutes,
  phase,
  window,
}: {
  bossMinutes: (phase: number) => number;
  date: Date;
  fullMockMinutes: number;
  getCheckpointDay: ((window: ExamWindow) => Date) | null;
  isDayBefore: boolean;
  minutes: number;
  mockDays: MockDays;
  mockMinutes: number;
  phase: number;
  window: ExamWindow;
}): FixedEvent[] {
  const day = toIsoDate(date);
  const review = fixedEvent({ key: `review:${day}`, kind: "review", minutes, title: "" });

  if (isDayBefore) {
    return minutes > 0 ? [review] : [];
  }

  if (isMockDay({ date, mockDays, window })) {
    const fullLength = window.kind === "finalStretch";
    const mock = fullLength ? fullMockMinutes : mockMinutes;
    return [mockEvent({ date, fullLength, minutes: mock, replacesDay: true })];
  }

  if (window.kind === "finalStretch") {
    return minutes > 0 ? [review] : [];
  }

  return getCheckpointDay && isPhaseCheckpointDay({ date, getCheckpointDay, window })
    ? [fixedEvent({ key: getBossKey(phase), kind: "boss", minutes: bossMinutes(phase), title: "" })]
    : [];
}

function getExamDayMinutes({
  calendar,
  date,
  rules,
  targetDate,
}: {
  calendar: StudyCalendar;
  date: Date;
  rules: ExamDayRules;
  targetDate: Date;
}): number {
  const minutes = getStudyMinutes({ calendar, date });
  const isDayBefore = addDays(date, 1).getTime() === targetDate.getTime();

  return isDayBefore && isLightDayBefore({ ...rules, targetDate })
    ? Math.min(minutes, DAY_BEFORE_EXAM_MINUTES)
    : minutes;
}

export function createExamDays({
  bossDays,
  bossMinutes = (phase) => getPlannedBossMinutes({ goalKind: "exam", phase }),
  calendar,
  eventWeekday,
  fullMockMinutes,
  mockMinutes,
  practiceBias,
  rules,
  targetDate,
  windows,
}: CalendarInput & {
  bossDays?: ExamBossDays;
  bossMinutes?: (phase: number) => number;
  eventWeekday: number;
  fullMockMinutes: number;
  mockMinutes: number;
  rules: ExamDayRules;
  targetDate: Date;
  windows: readonly ExamWindow[];
}): (date: Date) => DayShape {
  const dayBefore = addDays(targetDate, -1);
  const firstDay = windows[0]?.startDate ?? dayBefore;
  const isShortPlan = isShortExam({ planStart: firstDay, targetDate });

  const mockDays = getExamMockDays({
    calendar,
    eventWeekday,
    from: rules.from,
    fullMockMinutes,
    mockMinutes,
    shortMockMinutes: rules.shortMockMinutes,
    takenMocks: rules.takenMocks,
    targetDate,
    windows,
  });

  const checkpointDays = new Map<ExamWindow, Date>();

  const getCheckpointDay = (window: ExamWindow): Date => {
    const day = checkpointDays.get(window) ?? getPhaseCheckpointDay({ calendar, mockDays, window });
    checkpointDays.set(window, day);
    return day;
  };

  return (date) => {
    const window = findExamWindow({ date, windows });

    if (!window) {
      return { events: [], minutes: 0, open: false, phase: null, share: 0 };
    }

    const phase = windows.indexOf(window);
    const isDayBefore = date.getTime() === dayBefore.getTime();
    const minutes = getExamDayMinutes({ calendar, date, rules, targetDate });

    const events =
      isShortPlan || (isDayBefore && isMockDay({ date, mockDays, window }))
        ? getShortExamEvents({
            date,
            isFirstPracticeDay:
              window.kind === "practice" && date.getTime() === window.startDate.getTime(),
            isLastDay: window.kind === "finalStretch",
            isOnlyDay: isDayBefore && windows.length === 1,
            minutes,
            mockMinutes,
            shortMockMinutes: rules.shortMockMinutes,
          })
        : getExamEvents({
            bossMinutes,
            date,
            fullMockMinutes,
            getCheckpointDay: bossDays ? null : getCheckpointDay,
            isDayBefore,
            minutes,
            mockDays,
            mockMinutes,
            phase,
            window,
          });

    const bosses = bossDays && !isShortPlan ? listBossEvents({ bossDays, bossMinutes, date }) : [];

    return {
      events: withBossEvents({ bosses, events }),
      minutes,
      open: window.kind !== "finalStretch",
      phase,
      share: getLearningShare({ phaseKind: window.kind, practiceBias }),
    };
  };
}

/** Sessions build the day from it, so the plan and Today agree. */
export function getPlannedMinutes({
  calendar,
  date,
  exam,
  overflow = [],
  targetDate,
}: {
  calendar: StudyCalendar;
  date: Date;
  exam: ExamDayRules | null;
  overflow?: PlanSettings["checkpointOverflow"];
  targetDate: Date | null;
}): number {
  const funding = exam?.mockFunding ?? [];
  const day = toIsoDate(date);

  const extra = overflow
    .filter((entry) => entry.date === day)
    .reduce((sum, entry) => sum + entry.minutes, 0);

  if (targetDate && date >= targetDate) {
    const base = exam?.fullCourse && date > targetDate ? getStudyMinutes({ calendar, date }) : 0;
    return getFundedMinutes({ base, date, funding }) + extra;
  }

  const base =
    exam && targetDate
      ? getExamDayMinutes({ calendar, date, rules: exam, targetDate })
      : getStudyMinutes({ calendar, date });

  return getFundedMinutes({ base, date, funding }) + extra;
}
