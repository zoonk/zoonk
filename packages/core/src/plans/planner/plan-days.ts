import { type MockDays, getMockDays, getMockWeeks, isMockDay, isMockWeek } from "./mock-days";
import {
  type StudyCalendar,
  addDays,
  daysBetween,
  fromIsoDate,
  getStudyMinutes,
  toIsoDate,
} from "./plan-calendar";
import { type ExamWindow, findExamWindow, getLearningShare } from "./plan-phases";
import { type MovedEvent, type PlanSettings, type PracticeBias } from "./plan-state";
import { BOSS_MINUTES, getBossKey } from "./plan-units";
import { type DayShape, type FixedEvent } from "./schedule-units";
import { getShortExamEvents, isLightDayBefore, isShortExam, mockEvent } from "./short-exam-plan";

/** A weekly checkpoint outside exams: a short mixed challenge on the week's skills. */
export const WEEKLY_CHECKPOINT_MINUTES = 15;

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
  settings: Pick<PlanSettings, "fullCourse" | "shortMockMinutes" | "startDate">;
}): ExamDayRules | null {
  if (!isExam) {
    return null;
  }

  return {
    fullCourse: settings.fullCourse,
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
    return mockEvent({ date, minutes: mockMinutes, replacesDay: true });
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
  eventWeekday,
  mockMinutes = null,
  practiceBias,
  start,
  targetDate,
}: CalendarInput & {
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
      share,
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
  date: Date;
  fullMockMinutes: number;
  /** Each phase's checkpoint day (see `getPhaseCheckpointDay`), found once per phase. */
  getCheckpointDay: (window: ExamWindow) => Date;
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
    const mock = window.kind === "finalStretch" ? fullMockMinutes : mockMinutes;
    return [mockEvent({ date, minutes: mock, replacesDay: true })];
  }

  if (window.kind === "finalStretch") {
    return minutes > 0 ? [review] : [];
  }

  return isPhaseCheckpointDay({ date, getCheckpointDay, window })
    ? [fixedEvent({ key: getBossKey(phase), kind: "boss", minutes: BOSS_MINUTES, title: "" })]
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
  calendar,
  eventWeekday,
  fullMockMinutes,
  mockMinutes,
  practiceBias,
  rules,
  targetDate,
  windows,
}: CalendarInput & {
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
            date,
            fullMockMinutes,
            getCheckpointDay,
            isDayBefore,
            minutes,
            mockDays,
            mockMinutes,
            phase,
            window,
          });

    return {
      events,
      minutes,
      open: window.kind !== "finalStretch",
      phase,
      share: getLearningShare({ phaseKind: window.kind, practiceBias }),
    };
  };
}

/**
 * The minutes a learner has planned for one date: their weekday's time, halved in a light week,
 * none from the target date on (except the days after an exam whose plan studies everything), and
 * a short review the day before an exam (unless a short plan needs that day). Sessions build the
 * day from it, so the plan and Today agree.
 */
export function getPlannedMinutes({
  calendar,
  date,
  exam,
  targetDate,
}: {
  calendar: StudyCalendar;
  date: Date;
  /** The exam's day rules; null for goals that aren't exams. */
  exam: ExamDayRules | null;
  targetDate: Date | null;
}): number {
  if (targetDate && date >= targetDate) {
    return exam?.fullCourse && date > targetDate ? getStudyMinutes({ calendar, date }) : 0;
  }

  return exam && targetDate
    ? getExamDayMinutes({ calendar, date, rules: exam, targetDate })
    : getStudyMinutes({ calendar, date });
}

/** The week's checkpoint or mock can move; phase checkpoints and review days keep their day. */
const MOVABLE_EVENT_KINDS = new Set<FixedEvent["kind"]>(["checkpoint", "mock"]);

function isMovable(event: FixedEvent): boolean {
  return MOVABLE_EVENT_KINDS.has(event.kind);
}

/**
 * Days with the learner's moves applied ("Move to Monday"): the week's checkpoint or mock leaves
 * its day, which gets its lessons back, and lands on the later day. It's keyed by its new day, the
 * way a dated item is known across planning runs, so later runs keep it as the same item.
 */
export function withMovedEvents({
  describeDay,
  moves,
}: {
  describeDay: (date: Date) => DayShape;
  moves: readonly MovedEvent[];
}): (date: Date) => DayShape {
  if (moves.length === 0) {
    return describeDay;
  }

  return (date) => {
    const day = toIsoDate(date);
    const shape = describeDay(date);
    const movedOut = moves.some((move) => move.from === day);

    const movedIn = moves
      .filter((move) => move.to === day)
      .flatMap((move) =>
        describeDay(fromIsoDate(move.from))
          .events.filter(isMovable)
          .map((event) => ({ ...event, key: `${event.kind}:${move.to}` })),
      );

    if (!movedOut && movedIn.length === 0) {
      return shape;
    }

    const staying = movedOut ? shape.events.filter((event) => !isMovable(event)) : shape.events;

    return { ...shape, events: [...staying, ...movedIn] };
  };
}
