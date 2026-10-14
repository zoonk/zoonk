import { getCheckpointMinutes } from "../../checkpoints/checkpoint-minutes";
import { CHECKPOINT_QUESTIONS } from "../../checkpoints/checkpoint-rules";
import { getPlannedBossMinutes } from "./boss-minutes";
import { type ExamBossDays, listBossEvents } from "./exam-boss-days";
import { type MockDays, getMockDays, getMockWeeks, isMockDay, isMockWeek } from "./mock-days";
import { type MockFunding, getFundedMinutes } from "./mock-funding";
import {
  type StudyCalendar,
  addDays,
  daysBetween,
  fromIsoDate,
  getStudyMinutes,
  toIsoDate,
} from "./plan-calendar";
import { type ExamWindow, findExamWindow, getLearningShare } from "./plan-phases";
import { type PlanSettings, type PracticeBias } from "./plan-state";
import { getBossKey } from "./plan-units";
import { type DayShape, type FixedEvent } from "./schedule-units";
import { getShortExamEvents, isLightDayBefore, isShortExam, mockEvent } from "./short-exam-plan";

/** A weekly checkpoint outside exams: a short mixed challenge on the week's skills. */
/** The week's mixed checkpoint, before its questions are picked: its full ten. */
export const WEEKLY_CHECKPOINT_MINUTES = getCheckpointMinutes(CHECKPOINT_QUESTIONS);

/** The day before an exam is light: a short review, then rest. */
export const DAY_BEFORE_EXAM_MINUTES = 15;

/**
 * What an exam's days depend on besides the calendar: the plan's first day, which tells a test
 * days away, a class test's short mock, which rehearses it on the day before, and whether the plan
 * studies everything (`PlanSettings.fullCourse`), so its days go on after the exam.
 */
export type ExamDayRules = {
  /**
   * The first day the run plans (today) and the days of the plan's mocks the learner took: a plan,
   * or a phase two weeks long or more, whose weekly mock days are all past, and none taken, gets a
   * mock of its own (see `getMockDays`). Absent: a plan made today, no mock taken.
   */
  from?: Date;
  fullCourse?: boolean;
  /** The mocks the plan funds (see `PlanSettings.mockFunding`), which set days' time aside. */
  mockFunding?: readonly MockFunding[];
  planStart: Date | null;
  shortMockMinutes: number | null;
  takenMocks?: readonly Date[];
};

/** An exam's day rules from its plan's settings; null for goals that aren't exams. */
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

/** Weekly checkpoints start once the learner has a week of skills to mix. */
const DAY_OF_SECOND_WEEK = 7;

type CalendarInput = { calendar: StudyCalendar; practiceBias: PracticeBias };

function fixedEvent(
  event: Omit<FixedEvent, "replacesDay"> & { replacesDay?: boolean },
): FixedEvent {
  return { replacesDay: false, ...event };
}

/**
 * The week's event outside exam phases: a short mixed challenge, or an exam's weekly mock
 * (`mockMinutes`) in place of that day's lessons.
 */
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

/**
 * Days of a plan without exam phases: the learner's minutes, a weekly checkpoint from the second
 * week on, and nothing on or after the target date, when there is one. An exam's days without
 * phases (no date yet, or after an exam the plan goes on past) keep its weekly mock instead
 * (`mockMinutes`), every few weeks when it's longer than the learner's study day (see
 * `getMockWeeks`): every exam plan has mocks.
 */
export function createLearnDays({
  calendar,
  courseStart = false,
  eventWeekday,
  mockMinutes = null,
  practiceBias,
  start,
  targetDate,
}: CalendarInput & {
  courseStart?: boolean;
  eventWeekday: number;
  /** An exam's weekly mock, in place of the weekly checkpoint; null for other goals. */
  mockMinutes?: number | null;
  start: Date;
  targetDate: Date | null;
}): (date: Date) => DayShape {
  const firstCheckpoint = addDays(start, DAY_OF_SECOND_WEEK);
  const share = getLearningShare({ phaseKind: "learn", practiceBias });
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
      // A new plan has no earlier lessons to review; its first day uses the learner's time.
      share: courseStart && date.getTime() === start.getTime() && mockMinutes === null ? 1 : share,
    };
  };
}

/**
 * A phase closes with its checkpoint on its last study day that isn't a mock day: a rest day the
 * phase ends on never takes it. A phase without such a day keeps its last day.
 */
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
  /** A phase's boss's minutes (see `getPlannedBossMinutes`). */
  bossMinutes: (phase: number) => number;
  date: Date;
  fullMockMinutes: number;
  /**
   * Each phase's checkpoint day (see `getPhaseCheckpointDay`), found once per phase; null when the
   * run's settled days place them (see `listBossEvents`).
   */
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

  // The final stretch's mock is the whole exam day, as the mock itself asks it.
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

/**
 * An exam day's minutes: the learner's time, and a light review on the day before the exam unless
 * a short plan needs that day (see `isLightDayBefore`).
 */
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

/**
 * Days of an exam plan: each phase's share of new learning, weekly mocks from the plan's second
 * week in every phase, every few weeks when a mock is longer than the learner's study day (see
 * `getMockWeeks`; in place of that day's lessons; the whole exam day in the final stretch),
 * a checkpoint closing each phase before the final stretch, the final stretch as review days, and
 * a light day before the exam. A test days away keeps only its short plan's events: no phase
 * checkpoints or weekly mocks, its one mock, and a last day with nothing new.
 */
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
  /** Where the phase challenges go, as a run settles them (see `placeExamBosses`). */
  bossDays?: ExamBossDays;
  /** A phase's boss's minutes (see `getPlannedBossMinutes`); its size before the bank is read. */
  bossMinutes?: (phase: number) => number;
  eventWeekday: number;
  /** The final stretch's mocks: the real exam day's time, its written test included. */
  fullMockMinutes: number;
  /** The regular weeks' mocks: half the exam's first day. */
  mockMinutes: number;
  rules: ExamDayRules;
  targetDate: Date;
  windows: readonly ExamWindow[];
}): (date: Date) => DayShape {
  const dayBefore = addDays(targetDate, -1);
  const firstDay = windows[0]?.startDate ?? dayBefore;
  const isShortPlan = isShortExam({ planStart: firstDay, targetDate });

  const mockDays = getMockDays({
    calendar,
    eventWeekday,
    firstMockDay: addDays(firstDay, DAY_OF_SECOND_WEEK),
    from: rules.from,
    mockMinutes: { finalStretch: fullMockMinutes, weekly: mockMinutes },
    shortMockMinutes: rules.shortMockMinutes,
    takenMocks: rules.takenMocks,
    targetDate,
    windows,
  });

  // Every date of a phase asks for its checkpoint day: a plan a year long asked hundreds of times.
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

    // A class test's own mock on the day before (see `getMockDays`) goes as on a short plan's
    // last day: the short mock, then a review with the time left.
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

    // A short plan's days are its own (see `getShortExamEvents`): no phase challenges.
    const bosses = bossDays && !isShortPlan ? listBossEvents({ bossDays, bossMinutes, date }) : [];

    return {
      events: [...events, ...bosses],
      minutes,
      open: window.kind !== "finalStretch",
      phase,
      share: getLearningShare({ phaseKind: window.kind, practiceBias }),
    };
  };
}

/**
 * The minutes a learner has planned for one date: their weekday's time, halved in a light week,
 * none from the target date on (except the days after an exam whose plan studies everything), a
 * short review the day before an exam (unless a short plan needs that day), and the time the plan's
 * mocks set aside (see `getFundedMinutes`). Sessions build the day from it, so the plan and Today
 * agree.
 */
export function getPlannedMinutes({
  calendar,
  date,
  exam,
  overflow = [],
  targetDate,
}: {
  calendar: StudyCalendar;
  date: Date;
  /** The exam's day rules; null for goals that aren't exams. */
  exam: ExamDayRules | null;
  /** The time the days' checkpoints take past it (`PlanSettings.checkpointOverflow`). */
  overflow?: PlanSettings["checkpointOverflow"];
  targetDate: Date | null;
}): number {
  const funding = exam?.mockFunding ?? [];
  const day = toIsoDate(date);

  // A checkpoint runs whole on its day: the day asks for the time it takes past it too.
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
