import { type UsageKind } from "@zoonk/db";
import { type EntitlementTier } from "./contract";

/**
 * Hard caps (`day`, `month`, `total`, `generatedTotal`) block until the period resets.
 * `fairUseDay` never blocks: above it, each new use waits `FAIR_USE_SPACING_SECONDS` after the last.
 * `daySeconds` and `monthSeconds` cap the time a day's and a month's uses may run: live calls,
 * which the voice model bills by the second.
 */
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

/** A minute of a voice call: GPT-Live's $0.05, silence included. */
const CALL_MINUTE_COST_MICROS = 50_000;
const CALL_SECOND_COST_MICROS = CALL_MINUTE_COST_MICROS / SECONDS_PER_MINUTE;

/** The checks of what was said during a call and its feedback, whatever its length. */
const CALL_CHECKS_COST_MICROS = 10_000;

/**
 * What one minute of call time can cost at most: a one-minute call (a unit's call at A1 and A2)
 * that runs to its end, its goodbye past the end (the app hangs up 10 seconds later, which the
 * call time doesn't count) and its checks. Longer calls cost less a minute.
 */
const CALL_GOODBYE_SECONDS = 10;

const WORST_CALL_MINUTE_COST_MICROS =
  CALL_MINUTE_COST_MICROS +
  CALL_GOODBYE_SECONDS * CALL_SECOND_COST_MICROS +
  CALL_CHECKS_COST_MICROS;

/** The most Plus's calls may cost in a month: Plus is $19, and calls are its costliest feature. */
const PLUS_CALL_BUDGET_MICROS_A_MONTH = 6_000_000;

/**
 * Call time. Calls are paid by the minute, so the caps are time, not a number of calls. A unit's
 * call runs 1 to 4 minutes and a practice call or a speaking mock up to 5. A day: Plus's 20 minutes
 * fit a day of heavy speaking practice (a unit's call, two practice calls and a mock); the free
 * plan's 2 fit one short call, to try speaking. A month: Plus's calls stay within their budget even
 * when every call is a minute long (87 minutes, about $5.95), and the free plan's 5 minutes cost at
 * most about $0.35. Learners never see these numbers, only that Plus has higher call limits.
 */
const FREE_CALL_MINUTES_A_DAY = 2;
const PLUS_CALL_MINUTES_A_DAY = 20;
const FREE_CALL_MINUTES_A_MONTH = 5;

const PLUS_CALL_MINUTES_A_MONTH = Math.floor(
  PLUS_CALL_BUDGET_MICROS_A_MONTH / WORST_CALL_MINUTE_COST_MICROS,
);

/** A call shorter than this isn't worth starting: with less call time left, calls wait for more. */
export const MIN_CALL_SECONDS = SECONDS_PER_MINUTE;

/**
 * The allowance counts new lessons started, whether reused or generated, since learners can't tell
 * which is which. Quick explanations and reviews stay out of it. Guests get three lessons, at most
 * one of them newly generated, a goal to try the plan, and a day's worth of small AI help
 * (`assist`: understanding a goal, answer explanations, grading). A chapter's mind map counts only
 * when it's made for the learner (one that exists is free to read): free learners make three a
 * day and ten a month, about as many chapters as forty lessons finish; guests one.
 *
 * Free accounts and guests never get unlimited AI work: every kind has a cap that blocks, a day's
 * and a month's, sized from what a use costs (`COST_MICROS`) so a free month stays a few dollars
 * at most. Small help (`assist`, about $0.001–0.005 a call, or a test's few new questions) stops at
 * 100 a day and 500 a month, far above a busy learner's 40 a day; quick explanations (each a short
 * lesson with its pictures) at 5 a day and 20 a month. Plus keeps fair use.
 */
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
 * What a new mind map costs at list price: its text (Haiku 5.5, about $0.002), its picture (GPT
 * Image 2.5 Flare at low quality, about $0.01) and the check of its words ($0.0004), measured on
 * 2026-10-07; a picture redrawn after a failed check adds about $0.01.
 */
const MIND_MAP_COST_MICROS = 15_000;

/**
 * Estimated AI cost of one use, in millionths of a dollar, because provenance doesn't store cost.
 * Starting a lesson or explanation that already exists costs nothing; a call adds its seconds.
 */
const COST_MICROS: Record<UsageKind, number> = {
  assist: 5000,
  conversation: CALL_CHECKS_COST_MICROS,
  explanation: 20_000,
  goal: GOAL_COST_MICROS,
  lessonStart: GENERATED_LESSON_COST_MICROS,
  mindMap: MIND_MAP_COST_MICROS,
  tutorMessage: 5000,
  upload: 30_000,
};

/**
 * A learner's daily AI spend cap, in millionths of a dollar. It stops a runaway client or a
 * compromised account, not a busy learner: a free learner's day of three new goals, twenty new
 * lessons, three mind maps and two minutes of calls ($9.56 at the costs above) fits, and so does
 * everything a guest's hard caps allow (one goal, one new lesson, five quick explanations, forty
 * small helps and a mind map: $2.32), whatever the order.
 */
const DAILY_SPEND_BUDGET_MICROS: Record<EntitlementTier, number> = {
  free: 10_500_000,
  guest: 2_320_000,
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
