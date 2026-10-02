import { type UsageKind } from "@zoonk/db";
import { type EntitlementTier } from "./contract";

/**
 * Hard caps (`day`, `month`, `total`, `generatedTotal`) block until the period resets.
 * `fairUseDay` never blocks: above it, each new use waits `FAIR_USE_SPACING_SECONDS` after the last.
 */
type UsageRule = {
  day?: number;
  fairUseDay?: number;
  generatedTotal?: number;
  month?: number;
  total?: number;
};

/**
 * The allowance counts new lessons started, whether reused or generated, since learners can't tell
 * which is which. Quick explanations and reviews stay out of it. Guests get three lessons, at most
 * one of them newly generated, a goal to try the plan, and a day's worth of small AI help
 * (`assist`: understanding a goal, simpler or deeper versions, answer explanations, grading).
 */
const USAGE_RULES: Record<EntitlementTier, Record<UsageKind, UsageRule>> = {
  free: {
    assist: { fairUseDay: 300 },
    conversation: { day: 3 },
    explanation: { fairUseDay: 30 },
    goal: { day: 3 },
    lessonStart: { day: 20, month: 40 },
    tutorMessage: { day: 10 },
    upload: { day: 3 },
  },
  guest: {
    assist: { day: 40 },
    conversation: { total: 0 },
    explanation: { day: 5 },
    goal: { total: 1 },
    lessonStart: { generatedTotal: 1, total: 3 },
    tutorMessage: { total: 0 },
    upload: { total: 0 },
  },
  plus: {
    assist: { fairUseDay: 1000 },
    conversation: { fairUseDay: 30 },
    explanation: { fairUseDay: 200 },
    goal: { day: 10 },
    lessonStart: { fairUseDay: 200 },
    tutorMessage: { fairUseDay: 300 },
    upload: { fairUseDay: 30 },
  },
};

/** Free learners and guests follow one goal at a time; Plus only has the new-goals-per-day cap. */
const ACTIVE_GOAL_LIMITS: Record<EntitlementTier, number | null> = {
  free: 1,
  guest: 1,
  plus: null,
};

/**
 * What a new goal costs at list price (logged tokens × `apps/evals/data/gateway-prices.json`) when
 * nothing it needs is in the Library yet, as a guest's is written: research on a new exam's
 * notice (sources, blueprint and fact check, $0.16–0.23), the skill graph ($0.07–0.09), identity
 * search for its skills and lessons ($0.30–0.60 with its decisions), its courses' first bands
 * ($0.42–1.03, the most for an exam with many subjects) and placement's questions ($0.18–0.22,
 * batched; was $0.45–0.81). Measured on real cold guest goals on 2026-09-30 with batched
 * placement: SAT about $1.25 and Polícia Rodoviária Federal (Cebraspe) above $2.10, beside the
 * walkthrough's ENEM with its notice already read, about $1.00. Guests never start the courses'
 * other bands, their pictures or speculative lessons, and a goal whose skills and courses exist
 * costs far less.
 */
const GOAL_COST_MICROS = 1_800_000;

/**
 * What a newly written lesson costs at list price: its spec, draft and pictures (about $0.11),
 * plus the cross-family check and its fix pass (about $0.08–0.19) that exam and advanced lessons
 * always get and a fifth of the rest. An exam lesson measured $0.30 on 2026-09-30.
 */
const GENERATED_LESSON_COST_MICROS = 200_000;

/**
 * Estimated AI cost of one use, in millionths of a dollar, because provenance doesn't store cost.
 * Starting a lesson or explanation that already exists costs nothing.
 */
const COST_MICROS: Record<UsageKind, number> = {
  assist: 5000,
  conversation: 50_000,
  explanation: 20_000,
  goal: GOAL_COST_MICROS,
  lessonStart: GENERATED_LESSON_COST_MICROS,
  tutorMessage: 5000,
  upload: 30_000,
};

/**
 * A learner's daily AI spend cap, in millionths of a dollar. It stops a runaway client or a
 * compromised account, not a busy learner: a free learner's day of three new goals and twenty new
 * lessons ($9.40 at the costs above) fits, and so does everything a guest's hard caps allow (one
 * goal, one new lesson, five quick explanations and forty small helps: $2.30), whatever the order.
 */
const DAILY_SPEND_BUDGET_MICROS: Record<EntitlementTier, number> = {
  free: 9_500_000,
  guest: 2_300_000,
  plus: 30_000_000,
};

const REUSABLE_KINDS = new Set<UsageKind>(["explanation", "lessonStart"]);

/**
 * Exam prep on the free plan covers the diagnostic, the plan and its first week; Plus adds the rest
 * of the plan and mock exams. Planners and mocks enforce it from here.
 */
const EXAM_PREP_ACCESS: Record<
  EntitlementTier,
  { includesMockExams: boolean; studyDays: number | null }
> = {
  free: { includesMockExams: false, studyDays: 7 },
  guest: { includesMockExams: false, studyDays: 7 },
  plus: { includesMockExams: true, studyDays: null },
};

/** Above a fair-use threshold, a new use waits this long after the previous one. */
export const FAIR_USE_SPACING_SECONDS = 300;

/** A Vercel Firewall rate limit asks the client to wait this long instead of failing. */
export const RATE_LIMIT_RETRY_SECONDS = 60;

/**
 * The estimated AI spend all newcomers together (guests and accounts younger than a day) may start
 * in one UTC day, in millionths of a dollar: a backstop for an attack that gets past BotID with
 * many networks. At the costs above it's about 83 new goals a day, or 65 guests using everything
 * their hard caps allow; Sentry hears when a day passes 80%.
 */
export const NEWCOMER_DAILY_SPEND_BUDGET_MICROS = 150_000_000;

/** An account this many days old still shares the newcomers' budget: it outlasts a script's day. */
export const NEWCOMER_ACCOUNT_AGE_DAYS = 1;

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
}: {
  generated: boolean;
  kind: UsageKind;
}): number {
  return REUSABLE_KINDS.has(kind) && !generated ? 0 : COST_MICROS[kind];
}

export function getExamPrepAccess(tier: EntitlementTier) {
  return EXAM_PREP_ACCESS[tier];
}
