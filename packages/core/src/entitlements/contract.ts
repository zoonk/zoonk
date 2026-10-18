import { type UsageKind } from "@zoonk/db";

export type EntitlementTier = "free" | "guest" | "plus";

export type UsagePeriod = "day" | "month" | "total";

/**
 * What ran out: one kind of usage, the single active goal of the free plan, a guest's one newly
 * generated lesson, the plan's call time today or this month (its limit in seconds), or the
 * learner's daily AI budget.
 */
type AllowanceResource = UsageKind | "activeGoals" | "aiSpend" | "callSeconds" | "generatedLessons";

export type AllowanceLimit = {
  limit: number;
  period: UsagePeriod;
  resource: AllowanceResource;
  tier: EntitlementTier;
};

/**
 * `slowDown` is fair use: the action is allowed again after `retryAfterSeconds`, so learning never
 * hits a wall. `limitReached` is a hard cap of the learner's plan. `signUpRequired` is a guest's new
 * AI work once the day's AI budget all guests share is spent: a free account continues it, with
 * the guest's work moved over, whatever the guest's own caps say. A live call's connection is
 * allowed with the seconds it holds from the plan's call time (`heldSeconds`), and which cap,
 * today's or this month's, holds less than the call asked (`shortenedBy`).
 */
export type UsageDecision =
  | { heldSeconds?: number; shortenedBy?: "day" | "month"; status: "allowed" }
  | { limit: AllowanceLimit; status: "limitReached" }
  | { retryAfterSeconds: number; status: "slowDown" }
  | { status: "signUpRequired" }
  | { status: "unauthorized" };

/**
 * A claim the learner can't make now: slow down and try again, a cap of their plan, or (a guest)
 * create a free account to continue.
 */
export type RefusedUsage = Exclude<UsageDecision, { status: "allowed" | "unauthorized" }>;

const REFUSED_USAGE_STATUSES: ReadonlySet<string> = new Set<RefusedUsage["status"]>([
  "limitReached",
  "signUpRequired",
  "slowDown",
]);

/** Whether a capability's outcome is a refused claim, so callers answer it the way usage says. */
export function isRefusedUsage<TResult extends { status: string }>(
  result: TResult,
): result is Extract<TResult, { status: RefusedUsage["status"] }> {
  return REFUSED_USAGE_STATUSES.has(result.status);
}

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

function isUsedUp(limit: number | null, used: number): boolean {
  return limit !== null && used >= limit;
}

/**
 * The hard cap of the learner's plan a kind of usage already reached, as their allowance shows
 * it, so a screen says it before they tap instead of after: the period that ran out (a guest's
 * total, then the month, then the day) and their plan. Null while any is left, or when the plan
 * only has fair use for it.
 */
export function getReachedCap({
  allowance,
  kind,
}: {
  allowance: Pick<Allowance, "items" | "tier">;
  kind: UsageKind;
}): { period: UsagePeriod; status: "limitReached"; tier: EntitlementTier } | null {
  const item = allowance.items.find((entry) => entry.kind === kind);

  if (!item || item.remaining === null || item.remaining > 0) {
    return null;
  }

  const period = [
    isUsedUp(item.totalLimit, item.usedTotal) && ("total" as const),
    isUsedUp(item.monthlyLimit, item.usedThisMonth) && ("month" as const),
  ].find((value) => value !== false);

  return { period: period ?? "day", status: "limitReached", tier: allowance.tier };
}
