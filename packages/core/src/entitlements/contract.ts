import { type UsageKind } from "@zoonk/db";

export type EntitlementTier = "free" | "guest" | "plus";

type UsagePeriod = "day" | "month" | "total";

/**
 * What ran out: one kind of usage, the single active goal of the free plan, a guest's one newly
 * generated lesson, the plan's call time today or this month (its limit in seconds), the learner's
 * daily AI budget, or the daily AI budget all newcomers (guests and accounts younger than a day)
 * share.
 */
type AllowanceResource =
  | UsageKind
  | "activeGoals"
  | "aiSpend"
  | "callSeconds"
  | "generatedLessons"
  | "newcomerSpend";

export type AllowanceLimit = {
  limit: number;
  period: UsagePeriod;
  resource: AllowanceResource;
  tier: EntitlementTier;
};

/**
 * `slowDown` is fair use: the action is allowed again after `retryAfterSeconds`, so learning never
 * hits a wall. `limitReached` is a hard cap of the learner's plan. A live call's connection is
 * allowed with the seconds it holds from the plan's call time (`heldSeconds`), and which cap,
 * today's or this month's, holds less than the call asked (`shortenedBy`).
 */
export type UsageDecision =
  | { heldSeconds?: number; shortenedBy?: "day" | "month"; status: "allowed" }
  | { limit: AllowanceLimit; status: "limitReached" }
  | { retryAfterSeconds: number; status: "slowDown" }
  | { status: "unauthorized" };

/** A claim the learner can't make now: slow down and try again, or a cap of their plan. */
export type RefusedUsage = Exclude<UsageDecision, { status: "allowed" | "unauthorized" }>;

/** One kind of usage as the learner sees it: what they used and what their plan allows. */
export type AllowanceItem = {
  dailyLimit: number | null;
  /** Above this many uses a day, new uses are spaced out instead of blocked. */
  fairUseDailyLimit: number | null;
  kind: UsageKind;
  monthlyLimit: number | null;
  /** Uses left before a hard cap, or null when the plan only has fair use. */
  remaining: number | null;
  totalLimit: number | null;
  usedThisMonth: number;
  usedToday: number;
  usedTotal: number;
};

export type Allowance = {
  activeGoals: { limit: number | null; used: number };
  /**
   * Live call time, in seconds: the plan's caps today and this month (null without one) and what's
   * used of each.
   */
  callTime: {
    limitSeconds: number | null;
    monthLimitSeconds: number | null;
    usedSeconds: number;
    usedSecondsThisMonth: number;
  };
  /** Exam prep in the plan: mock exams, and how many days of an exam plan (null for all of it). */
  examPrep: { includesMockExams: boolean; studyDays: number | null };
  /** A guest's newly generated lessons; null for accounts. */
  generatedLessons: { limit: number; used: number } | null;
  items: AllowanceItem[];
  resets: { day: Date; month: Date };
  tier: EntitlementTier;
};
