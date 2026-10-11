import { type ShortExamFocus } from "../plan-view-contract";
import { daysBetween, toIsoDate } from "./plan-calendar";
import { type FixedEvent } from "./schedule-units";

/**
 * A test at most a week away (a class test on Friday) gets a plan of its own, day by day: the
 * topics the exam asks most that the learner doesn't know yet, then practice from their material,
 * and a last day with nothing new. A foundations phase, phase checkpoints and weekly mocks don't
 * fit in a few days, so a short plan has none: it rehearses with one mock instead (see
 * `getShortExamEvents`).
 */
const SHORT_EXAM_MAX_DAYS = 7;

/** Of the days before the last one, the share for the exam map and the learner's gaps. */
const MAP_AND_GAPS_SHARE = 0.6;

/** Less than this left after the short mock isn't worth a review of its own. */
const MIN_REVIEW_MINUTES = 5;

/**
 * A test tomorrow puts the gaps first: its short mock closes the day only when at least as much
 * time is left for learning.
 */
const ONLY_DAY_MOCK_SHARE = 0.5;

export type ShortExamPhaseKind = "finalStretch" | "gaps" | "practice";

/** Whether the days from the plan's start to the exam make it a short plan. */
export function isShortExam({ planStart, targetDate }: { planStart: Date; targetDate: Date }) {
  const studyDays = daysBetween(planStart, targetDate);
  return studyDays > 0 && studyDays <= SHORT_EXAM_MAX_DAYS;
}

/**
 * A short plan's phases and their days: the map and gaps, then practice, then the day before the
 * test on its own. A test tomorrow leaves one day, which has to teach, so it all goes to the map
 * and gaps; a class test's short mock closes it.
 */
export function getShortExamPhaseDays(studyDays: number): [ShortExamPhaseKind, number][] {
  if (studyDays <= 1) {
    return [["gaps", Math.max(0, studyDays)]];
  }

  const before = studyDays - 1;
  const gaps = Math.max(1, Math.round(before * MAP_AND_GAPS_SHARE));

  const lengths: [ShortExamPhaseKind, number][] = [
    ["gaps", gaps],
    ["practice", before - gaps],
    ["finalStretch", 1],
  ];

  return lengths.filter(([, days]) => days > 0);
}

/**
 * The focus of a short plan's phase. The last day rehearses with the test's short mock when it has
 * one (a class test from the learner's material); a public exam's mock is half an exam day at the
 * least, so it opens the practice days instead and the last day stays a light review.
 */
export function getShortExamFocus({
  kind,
  shortMockMinutes,
}: {
  kind: ShortExamPhaseKind;
  shortMockMinutes: number | null;
}): ShortExamFocus {
  if (kind === "gaps") {
    return "mapAndGaps";
  }

  if (kind === "practice") {
    return shortMockMinutes ? "practice" : "mockAndPractice";
  }

  return shortMockMinutes ? "mockAndReview" : "lightReview";
}

/**
 * Whether the day before a test keeps only a light review. It always does, except in a short plan
 * whose only day it is (there's no other day to learn on) or whose class test rehearses with its
 * short mock that day.
 */
export function isLightDayBefore({
  planStart,
  shortMockMinutes,
  targetDate,
}: {
  planStart: Date | null;
  shortMockMinutes: number | null;
  targetDate: Date;
}): boolean {
  if (!planStart || !isShortExam({ planStart, targetDate })) {
    return true;
  }

  return daysBetween(planStart, targetDate) > 1 && !shortMockMinutes;
}

export function mockEvent({
  date,
  minutes,
  replacesDay,
}: {
  date: Date;
  minutes: number;
  replacesDay: boolean;
}): FixedEvent {
  return { key: `mock:${toIsoDate(date)}`, kind: "mock", minutes, replacesDay, title: "" };
}

function reviewEvent({ date, minutes }: { date: Date; minutes: number }): FixedEvent {
  return {
    key: `review:${toIsoDate(date)}`,
    kind: "review",
    minutes,
    replacesDay: false,
    title: "",
  };
}

/**
 * A short plan day's fixed events. The last day is the class test's short mock in place of
 * lessons, then a review of what it finds with the time left, or a public exam's light review; a
 * public exam rehearses with its weekly mock (half an exam day) on the first practice day
 * instead, leaving the days after it to go over its mistakes. A test tomorrow gets its short mock
 * after the day's lessons when the day has room for both. The review keeps new lessons off the
 * last day even for a learner who fell behind.
 */
export function getShortExamEvents({
  date,
  isFirstPracticeDay,
  isLastDay,
  isOnlyDay,
  minutes,
  mockMinutes,
  shortMockMinutes,
}: {
  date: Date;
  isFirstPracticeDay: boolean;
  isLastDay: boolean;
  isOnlyDay: boolean;
  /** The day's study minutes, with the light day before already applied. */
  minutes: number;
  /** The exam's weekly mock, which a public exam's short plan rehearses with. */
  mockMinutes: number;
  shortMockMinutes: number | null;
}): FixedEvent[] {
  if (isFirstPracticeDay && !shortMockMinutes) {
    return [mockEvent({ date, minutes: mockMinutes, replacesDay: true })];
  }

  if (isOnlyDay) {
    return shortMockMinutes && shortMockMinutes <= minutes * ONLY_DAY_MOCK_SHARE
      ? [mockEvent({ date, minutes: shortMockMinutes, replacesDay: false })]
      : [];
  }

  if (!isLastDay) {
    return [];
  }

  if (!shortMockMinutes) {
    return minutes > 0 ? [reviewEvent({ date, minutes })] : [];
  }

  // The short mock fits the day: on a day the learner gives less time, it's shorter (see
  // `withClassTestMock`).
  const shortMock = minutes > 0 ? Math.min(shortMockMinutes, minutes) : shortMockMinutes;
  const reviewMinutes = minutes - shortMock;

  return [
    mockEvent({ date, minutes: shortMock, replacesDay: true }),
    ...(reviewMinutes >= MIN_REVIEW_MINUTES ? [reviewEvent({ date, minutes: reviewMinutes })] : []),
  ];
}
