import { type UsageKind } from "@zoonk/db";
import { type EntitlementTier } from "./contract";

/** Hard caps block until reset; fair use spaces new requests without blocking the period. */
type UsageRule = {
  day?: number;
  daySeconds?: number;
  fairUseDay?: number;
  generatedTotal?: number;
  month?: number;
  monthSeconds?: number;
  total?: number;
};

const SECONDS_PER_MINUTE = 60;

const CALL_MINUTE_COST_MICROS = 50_000;
const CALL_SECOND_COST_MICROS = CALL_MINUTE_COST_MICROS / SECONDS_PER_MINUTE;

const CALL_CHECKS_COST_MICROS = 10_000;

/** Connection overhead reserves money without reducing the learner's allowed talk time. */
const LIVE_CALL_OVERHEAD_SECONDS = 15;
export const LIVE_CALL_INITIALIZATION_SECONDS = 15;
export const LIVE_CALL_ATTEMPTS_PER_DAY = 30;
export const LIVE_CALL_CONNECT_WINDOW_SECONDS = 60;

/** Budget for a reconnect within each minute, including both connections' overhead. */
const WORST_CALL_MINUTE_COST_MICROS =
  CALL_MINUTE_COST_MICROS +
  2 * LIVE_CALL_OVERHEAD_SECONDS * CALL_SECOND_COST_MICROS +
  CALL_CHECKS_COST_MICROS;

/** Reservations bound admission; settlement still records overruns. */
const PLUS_CALL_BUDGET_MICROS_A_MONTH = 7_400_000;
const FREE_CALL_MINUTES_A_DAY = 2;
const PLUS_CALL_MINUTES_A_DAY = 20;
const FREE_CALL_MINUTES_A_MONTH = 5;

const PLUS_CALL_MINUTES_A_MONTH = Math.floor(
  PLUS_CALL_BUDGET_MICROS_A_MONTH / WORST_CALL_MINUTE_COST_MICROS,
);

export function getCallMonthlyBudgetMicros(tier: EntitlementTier): number {
  if (tier === "plus") {
    return PLUS_CALL_BUDGET_MICROS_A_MONTH;
  }

  return tier === "free" ? FREE_CALL_MINUTES_A_MONTH * WORST_CALL_MINUTE_COST_MICROS : 0;
}

export function getLiveCallCostMicros(seconds: number): number {
  return (
    CALL_CHECKS_COST_MICROS +
    Math.ceil(Math.max(LIVE_CALL_INITIALIZATION_SECONDS, seconds) * CALL_SECOND_COST_MICROS)
  );
}

export function getLiveCallReservationMicros(seconds: number): number {
  return getLiveCallCostMicros(seconds + LIVE_CALL_OVERHEAD_SECONDS);
}

export const MIN_CALL_SECONDS = SECONDS_PER_MINUTE;

const USAGE_RULES: Record<EntitlementTier, Record<UsageKind, UsageRule>> = {
  free: {
    assist: { day: 100, month: 500 },
    conversation: {
      daySeconds: FREE_CALL_MINUTES_A_DAY * SECONDS_PER_MINUTE,
      monthSeconds: FREE_CALL_MINUTES_A_MONTH * SECONDS_PER_MINUTE,
    },
    explanation: { day: 5, month: 20 },
    goal: { day: 3, month: 10 },
    lessonStart: { day: 20, month: 40 },
    mindMap: { day: 3, month: 10 },
    mockQuestions: { total: 0 },
    outline: { day: 3, month: 10 },
    tutorMessage: { day: 10, month: 100 },
    upload: { day: 3, month: 10 },
  },
  guest: {
    assist: { day: 40, month: 100 },
    conversation: { total: 0 },
    explanation: { day: 5, month: 10 },
    goal: { total: 1 },
    lessonStart: { generatedTotal: 1, total: 3 },
    mindMap: { total: 1 },
    mockQuestions: { total: 0 },
    outline: { total: 1 },
    tutorMessage: { total: 0 },
    upload: { total: 0 },
  },
  plus: {
    assist: { fairUseDay: 1000 },
    conversation: {
      daySeconds: PLUS_CALL_MINUTES_A_DAY * SECONDS_PER_MINUTE,
      monthSeconds: PLUS_CALL_MINUTES_A_MONTH * SECONDS_PER_MINUTE,
    },
    explanation: { fairUseDay: 200 },
    goal: { day: 10 },
    lessonStart: { fairUseDay: 200 },
    mindMap: { fairUseDay: 30 },
    mockQuestions: { day: 2, month: 10 },
    outline: { fairUseDay: 30 },
    tutorMessage: { fairUseDay: 300 },
    upload: { fairUseDay: 30 },
  },
};

const ACTIVE_GOAL_LIMITS: Record<EntitlementTier, number | null> = {
  free: 1,
  guest: 1,
  plus: null,
};

const GOAL_COST_MICROS = 1_800_000;

const GENERATED_LESSON_COST_MICROS = 200_000;

const MIND_MAP_COST_MICROS = 15_000;

const OUTLINE_COST_MICROS = 150_000;

const MOCK_QUESTIONS_COST_MICROS = 600_000;

/** Costs are USD millionths; reusable content is free, and calls add their seconds. */
const COST_MICROS: Record<UsageKind, number> = {
  assist: 5000,
  conversation: CALL_CHECKS_COST_MICROS,
  explanation: 20_000,
  goal: GOAL_COST_MICROS,
  lessonStart: GENERATED_LESSON_COST_MICROS,
  mindMap: MIND_MAP_COST_MICROS,
  mockQuestions: MOCK_QUESTIONS_COST_MICROS,
  outline: OUTLINE_COST_MICROS,
  tutorMessage: 5000,
  upload: 30_000,
};

const DAILY_SPEND_BUDGET_MICROS: Record<EntitlementTier, number> = {
  free: 10_500_000,
  guest: 2_470_000,
  plus: 30_000_000,
};

const REUSABLE_KINDS = new Set<UsageKind>(["explanation", "lessonStart"]);

const EXAM_PREP_ACCESS: Record<
  EntitlementTier,
  { includesMockExams: boolean; studyDays: number | null }
> = {
  free: { includesMockExams: false, studyDays: 7 },
  guest: { includesMockExams: false, studyDays: 7 },
  plus: { includesMockExams: true, studyDays: null },
};

export const FAIR_USE_SPACING_SECONDS = 300;

/** Shared guest AI budget per UTC day; exhaustion requires sign-up rather than spending another guest's allowance. */
export const GUEST_DAILY_SPEND_BUDGET_MICROS = 150_000_000;

export function getUsageRule({ kind, tier }: { kind: UsageKind; tier: EntitlementTier }) {
  return USAGE_RULES[tier][kind];
}

export function getActiveGoalLimit(tier: EntitlementTier): number | null {
  return ACTIVE_GOAL_LIMITS[tier];
}

export function getDailySpendBudgetMicros(tier: EntitlementTier): number {
  return DAILY_SPEND_BUDGET_MICROS[tier];
}

export function getEstimatedCostMicros({
  generated,
  kind,
  seconds = 0,
}: {
  generated: boolean;
  kind: UsageKind;
  /** A call's time, paid by the second. */
  seconds?: number;
}): number {
  if (REUSABLE_KINDS.has(kind) && !generated) {
    return 0;
  }

  return COST_MICROS[kind] + Math.round(seconds * CALL_SECOND_COST_MICROS);
}

export function getExamPrepAccess(tier: EntitlementTier) {
  return EXAM_PREP_ACCESS[tier];
}
