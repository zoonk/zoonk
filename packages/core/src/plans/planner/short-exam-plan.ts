import { type ShortExamFocus } from "../plan-view-contract";
import { daysBetween, toIsoDate } from "./plan-calendar";
import { type FixedEvent } from "./schedule-units";

const SHORT_EXAM_MAX_DAYS = 7;

const MAP_AND_GAPS_SHARE = 0.6;

const MIN_REVIEW_MINUTES = 5;

const ONLY_DAY_MOCK_SHARE = 0.5;

export type ShortExamPhaseKind = "finalStretch" | "gaps" | "practice";

export function isShortExam({ planStart, targetDate }: { planStart: Date; targetDate: Date }) {
  const studyDays = daysBetween(planStart, targetDate);
  return studyDays > 0 && studyDays <= SHORT_EXAM_MAX_DAYS;
}

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
  fullLength,
  minutes,
  replacesDay,
}: {
  date: Date;
  fullLength?: boolean;
  minutes: number;
  replacesDay: boolean;
}): FixedEvent {
  return {
    key: `mock:${toIsoDate(date)}`,
    kind: "mock",
    minutes,
    ...(fullLength === undefined ? {} : { mock: { fullLength } }),
    replacesDay,
    title: "",
  };
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
  minutes: number;
  mockMinutes: number;
  shortMockMinutes: number | null;
}): FixedEvent[] {
  if (isFirstPracticeDay && !shortMockMinutes) {
    return [mockEvent({ date, fullLength: false, minutes: mockMinutes, replacesDay: true })];
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

  const shortMock = minutes > 0 ? Math.min(shortMockMinutes, minutes) : shortMockMinutes;
  const reviewMinutes = minutes - shortMock;

  return [
    mockEvent({ date, minutes: shortMock, replacesDay: true }),
    ...(reviewMinutes >= MIN_REVIEW_MINUTES ? [reviewEvent({ date, minutes: reviewMinutes })] : []),
  ];
}
