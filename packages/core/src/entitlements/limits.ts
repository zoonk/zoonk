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

/** Budgeted transport overhead, separate from the learner's practice allowance. */
export const LIVE_CALL_GRACE_SECONDS = 15;
const LIVE_CALL_CLOSE_ALLOWANCE_SECONDS = 15;
export const LIVE_CALL_INITIALIZATION_SECONDS = 15;
export const LIVE_CALL_ATTEMPTS_PER_CONVERSATION = 6;
export const LIVE_CALL_ATTEMPTS_PER_DAY = 30;
export const LIVE_CALL_HEALTH_THRESHOLD_MS = 300_000;

const WORST_CALL_MINUTE_COST_MICROS =
  CALL_MINUTE_COST_MICROS +
  (LIVE_CALL_GRACE_SECONDS + LIVE_CALL_CLOSE_ALLOWANCE_SECONDS) * CALL_SECOND_COST_MICROS +
  CALL_CHECKS_COST_MICROS;

/** Admission budget, including every reconnect; actual overrun is still recorded. */
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
  return getLiveCallCostMicros(
    seconds + LIVE_CALL_GRACE_SECONDS + LIVE_CALL_CLOSE_ALLOWANCE_SECONDS,
  );
}

/** A call shorter than this isn't worth starting: with less call time left, calls wait for more. */
export const MIN_CALL_SECONDS = SECONDS_PER_MINUTE;

/**
 * The allowance counts new lessons started, whether reused or generated, since learners can't tell
 * which is which. Quick explanations and reviews stay out of it. Guests get three lessons, at most
 * one of them newly generated, a goal to try the plan, and a day's worth of small AI help
 * (`assist`: understanding a goal, answer explanations, grading). A chapter's mind map counts only
 * when it's made for the learner (one that exists is free to read): free learners make three a
 * day and ten a month, about as many chapters as forty lessons finish; guests one. So does a far
 * topic's lesson plan (`outline`), written when the learner asks to see it before the plan gets
 * close (one that exists or is being written is free): three a day and ten a month for free
 * learners, one for guests, fair use for Plus; the plan writes every topic's anyway as it gets
 * close.
 *
 * Free accounts and guests never get unlimited AI work: every kind has a cap that blocks, a day's
 * and a month's, sized from what a use costs (`COST_MICROS`) so a free month stays a few dollars
 * at most. Small help (`assist`, about $0.001–0.005 a call, or a test's few new questions) stops at
 * 100 a day and 500 a month, far above a busy learner's 40 a day; quick explanations (each a short
 * lesson with its pictures) at 5 a day and 20 a month. Plus keeps fair use.
 *
 * Mock exams come with Plus, taken any time and as often as the learner wants (see
 * `startAnytimeMock`). A mock asks questions the learner never answered first; when the bank has
 * too few, new ones are written for it (`mockQuestions`, one use per mock that needs them), which
 * then serve every later learner of the exam. Plus has that for two mocks a day and ten a month:
 * the plan's weekly mock never writes, so ten is two or three more mocks a week with new questions
 * on an exam nobody studied before (an exam others study mostly needs none). Past it, nothing
 * waits: the mock asks questions the learner answered before, the missed ones first, and the cap
 * only bounds the cost, about $6 a month for subjects or half days written from scratch (see
 * `MOCK_QUESTIONS_COST_MICROS`), about $12 if every one were a whole exam day. Without Plus there
 * are no mocks, so none are written.
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
 * What a far topic's lesson plan costs at list price: its course band's outline, written while the
 * learner waits ($0.06–0.09 at the standard tier, up to $0.20 for an exam's at the priority tier),
 * and the identity search that saves its chapters and lessons (about $0.015), measured on
 * 2026-10-09.
 */
const OUTLINE_COST_MICROS = 150_000;

/**
 * What writing a mock's missing questions costs at list price: ENEM's Mathematics (45 questions)
 * written from scratch measured $0.61 on 2026-10-09 (25 calls writing each skill's share, $0.58,
 * and the pictures two questions needed), so about $0.60 for a subject or half a day, and twice
 * that for a whole day.
 */
const MOCK_QUESTIONS_COST_MICROS = 600_000;

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
  mockQuestions: MOCK_QUESTIONS_COST_MICROS,
  outline: OUTLINE_COST_MICROS,
  tutorMessage: 5000,
  upload: 30_000,
};

/**
 * A learner's daily AI spend cap, in millionths of a dollar. It stops a runaway client or a
 * compromised account, not a busy learner: a free learner's day of three new goals, twenty new
 * lessons, three mind maps, three lesson plans and two minutes of calls ($10.01 at the costs
 * above) fits, and so does everything a guest's hard caps allow (one goal, one new lesson, five
 * quick explanations, forty small helps, a mind map and a lesson plan: $2.47), whatever the order.
 */
const DAILY_SPEND_BUDGET_MICROS: Record<EntitlementTier, number> = {
  free: 10_500_000,
  guest: 2_470_000,
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

/**
 * The estimated AI spend all guests together may start in one UTC day, in millionths of a dollar.
 * Only BotID stands before a new guest, so this bounds what a flood of them can spend: about 83 new
 * goals a day at the costs above, or 60 guests using everything their hard caps allow. Sentry hears
 * when a day passes 80%. Once it's spent, a guest's new AI work asks them to create a free account
 * (`signUpRequired`), where their work moves with them; accounts never share it.
 */
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
