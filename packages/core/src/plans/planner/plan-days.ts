import {
  type StudyCalendar,
  addDays,
  fromIsoDate,
  getStudyMinutes,
  toIsoDate,
} from "./plan-calendar";
import { type ExamWindow, findExamWindow, getLearningShare } from "./plan-phases";
import { type MovedEvent, type PlanSettings, type PracticeBias } from "./plan-state";
import { BOSS_MINUTES, getBossKey } from "./plan-units";
import { type DayShape, type FixedEvent } from "./schedule-units";
import { getShortExamEvents, isLightDayBefore, isShortExam } from "./short-exam-plan";

/** A weekly checkpoint outside exams: a short mixed challenge on the week's skills. */
export const WEEKLY_CHECKPOINT_MINUTES = 15;

/** The day before an exam is light: a short review, then rest. */
export const DAY_BEFORE_EXAM_MINUTES = 15;

/**
 * What an exam's days depend on besides the calendar: the plan's first day, which tells a test
 * days away, and a class test's short mock, which rehearses it on the day before.
 */
export type ExamDayRules = { planStart: Date | null; shortMockMinutes: number | null };

/** An exam's day rules from its plan's settings; null for goals that aren't exams. */
export function getExamDayRules({
  isExam,
  settings,
}: {
  isExam: boolean;
  settings: Pick<PlanSettings, "shortMockMinutes" | "startDate">;
}): ExamDayRules | null {
  if (!isExam) {
    return null;
  }

  return {
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
 * Days of a plan without exam phases: the learner's minutes, a weekly checkpoint from the second
 * week on, and nothing on or after the target date, when there is one.
 */
export function createLearnDays({
  calendar,
  eventWeekday,
  practiceBias,
  start,
  targetDate,
}: CalendarInput & { eventWeekday: number; start: Date; targetDate: Date | null }): (
  date: Date,
) => DayShape {
  const firstCheckpoint = addDays(start, DAY_OF_SECOND_WEEK);
  const share = getLearningShare({ phaseKind: "learn", practiceBias });

  return (date) => {
    const open = targetDate === null || date < targetDate;
    const isCheckpointDay = date >= firstCheckpoint && date.getUTCDay() === eventWeekday;

    const checkpoint = fixedEvent({
      key: `checkpoint:${toIsoDate(date)}`,
      kind: "checkpoint",
      minutes: WEEKLY_CHECKPOINT_MINUTES,
      title: "",
    });

    return {
      events: open && isCheckpointDay ? [checkpoint] : [],
      minutes: open ? getStudyMinutes({ calendar, date }) : 0,
      open,
      phase: null,
      share,
    };
  };
}

function isMockDay({
  date,
  eventWeekday,
  window,
}: {
  date: Date;
  eventWeekday: number;
  window: ExamWindow;
}): boolean {
  return window.kind !== "foundations" && date.getUTCDay() === eventWeekday;
}

/** A phase closes with its checkpoint on its last day, or the day before when that's a mock day. */
function isPhaseCheckpointDay({
  date,
  eventWeekday,
  window,
}: {
  date: Date;
  eventWeekday: number;
  window: ExamWindow;
}): boolean {
  const end = window.endDate;
  const checkpointDay = isMockDay({ date: end, eventWeekday, window }) ? addDays(end, -1) : end;

  return window.kind !== "finalStretch" && date.getTime() === checkpointDay.getTime();
}

function getExamEvents({
  date,
  eventWeekday,
  isDayBefore,
  minutes,
  mockMinutes,
  phase,
  window,
}: {
  date: Date;
  eventWeekday: number;
  isDayBefore: boolean;
  minutes: number;
  mockMinutes: number;
  phase: number;
  window: ExamWindow;
}): FixedEvent[] {
  const day = toIsoDate(date);
  const review = fixedEvent({ key: `review:${day}`, kind: "review", minutes, title: "" });

  if (isDayBefore) {
    return minutes > 0 ? [review] : [];
  }

  if (isMockDay({ date, eventWeekday, window })) {
    return [
      fixedEvent({
        key: `mock:${day}`,
        kind: "mock",
        minutes: mockMinutes,
        replacesDay: true,
        title: "",
      }),
    ];
  }

  if (window.kind === "finalStretch") {
    return minutes > 0 ? [review] : [];
  }

  return isPhaseCheckpointDay({ date, eventWeekday, window })
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
 * Days of an exam plan: each phase's share of new learning, weekly mocks from the gaps phase on
 * (in place of that day's lessons), a checkpoint closing each phase before the final stretch, the
 * final stretch as review days, and a light day before the exam. A test days away keeps only its
 * short plan's events: no phase checkpoints or weekly mocks, and a last day with nothing new.
 */
export function createExamDays({
  calendar,
  eventWeekday,
  mockMinutes,
  practiceBias,
  rules,
  targetDate,
  windows,
}: CalendarInput & {
  eventWeekday: number;
  mockMinutes: number;
  rules: ExamDayRules;
  targetDate: Date;
  windows: readonly ExamWindow[];
}): (date: Date) => DayShape {
  const dayBefore = addDays(targetDate, -1);
  const firstDay = windows[0]?.startDate ?? dayBefore;
  const isShortPlan = isShortExam({ planStart: firstDay, targetDate });

  return (date) => {
    const window = findExamWindow({ date, windows });

    if (!window) {
      return { events: [], minutes: 0, open: false, phase: null, share: 0 };
    }

    const phase = windows.indexOf(window);
    const isDayBefore = date.getTime() === dayBefore.getTime();
    const minutes = getExamDayMinutes({ calendar, date, rules, targetDate });

    const events = isShortPlan
      ? getShortExamEvents({
          date,
          isLastDay: window.kind === "finalStretch",
          isOnlyDay: isDayBefore && windows.length === 1,
          minutes,
          shortMockMinutes: rules.shortMockMinutes,
        })
      : getExamEvents({ date, eventWeekday, isDayBefore, minutes, mockMinutes, phase, window });

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
 * none from the target date on, and a short review the day before an exam (unless a short plan
 * needs that day). Sessions build the day from it, so the plan and Today agree.
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
    return 0;
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
