import { type UsageKind } from "@zoonk/db";
import { type AllowanceLimit, type EntitlementTier, type UsageDecision } from "../contract";
import {
  FAIR_USE_SPACING_SECONDS,
  getActiveGoalLimit,
  getDailySpendBudgetMicros,
  getUsageRule,
} from "../limits";
import { type UsageCounts } from "./usage-counts";

const MS_PER_SECOND = 1000;

type UsageClaim = {
  costMicros: number;
  counts: UsageCounts;
  generated: boolean;
  kind: UsageKind;
  now: Date;
  tier: EntitlementTier;
};

type LimitCheck = Omit<AllowanceLimit, "tier"> & { used: number };

/** Lists the plan's hard caps for this use, in the order a learner would best understand them. */
function getLimitChecks({ counts, generated, kind, tier }: UsageClaim): LimitCheck[] {
  const rule = getUsageRule({ kind, tier });
  const activeGoalLimit = kind === "goal" ? getActiveGoalLimit(tier) : null;

  const checks: (LimitCheck | false)[] = [
    rule.total !== undefined && {
      limit: rule.total,
      period: "total",
      resource: kind,
      used: counts.total,
    },
    generated &&
      rule.generatedTotal !== undefined && {
        limit: rule.generatedTotal,
        period: "total",
        resource: "generatedLessons",
        used: counts.generatedTotal,
      },
    rule.day !== undefined && { limit: rule.day, period: "day", resource: kind, used: counts.day },
    rule.month !== undefined && {
      limit: rule.month,
      period: "month",
      resource: kind,
      used: counts.month,
    },
    activeGoalLimit !== null && {
      limit: activeGoalLimit,
      period: "total",
      resource: "activeGoals",
      used: counts.activeGoals,
    },
  ];

  return checks.filter((check): check is LimitCheck => check !== false);
}

function findReachedLimit(claim: UsageClaim): AllowanceLimit | null {
  const reached = getLimitChecks(claim).find((check) => check.used >= check.limit);

  if (reached) {
    return {
      limit: reached.limit,
      period: reached.period,
      resource: reached.resource,
      tier: claim.tier,
    };
  }

  const budget = getDailySpendBudgetMicros(claim.tier);

  if (claim.costMicros > 0 && claim.counts.spentTodayMicros + claim.costMicros > budget) {
    return { limit: budget, period: "day", resource: "aiSpend", tier: claim.tier };
  }

  return null;
}

/** Above the fair-use threshold, each new use waits a few minutes after the previous one. */
function getFairUseWaitSeconds({ counts, kind, now, tier }: UsageClaim): number | null {
  const { fairUseDay } = getUsageRule({ kind, tier });

  if (fairUseDay === undefined || counts.day < fairUseDay || !counts.lastUsedAt) {
    return null;
  }

  const elapsedSeconds = (now.getTime() - counts.lastUsedAt.getTime()) / MS_PER_SECOND;
  const waitSeconds = Math.ceil(FAIR_USE_SPACING_SECONDS - elapsedSeconds);

  return waitSeconds > 0 ? waitSeconds : null;
}

/**
 * Judges one new use against the learner's plan: hard caps and the daily AI budget block, while
 * fair use only slows unusual volume down.
 */
export function evaluateUsage(claim: UsageClaim): UsageDecision {
  const limit = findReachedLimit(claim);

  if (limit) {
    return { limit, status: "limitReached" };
  }

  const waitSeconds = getFairUseWaitSeconds(claim);

  return waitSeconds === null
    ? { status: "allowed" }
    : { retryAfterSeconds: waitSeconds, status: "slowDown" };
}
