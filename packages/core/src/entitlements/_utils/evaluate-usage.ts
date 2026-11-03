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

export type CallTimePeriod = "day" | "month";

export type CallTimeLeft = { limit: number; period: CallTimePeriod; seconds: number };

/** Null means uncapped; an exhausted monthly cap takes precedence because tomorrow cannot reset it. */
export function getCallTimeLeft({
  kind,
  tier,
  usedThisMonth,
  usedToday,
}: {
  kind: UsageKind;
  tier: EntitlementTier;
  usedThisMonth: number;
  usedToday: number;
}): CallTimeLeft | null {
  const { daySeconds, monthSeconds } = getUsageRule({ kind, tier });

  const day: CallTimeLeft | null =
    daySeconds === undefined
      ? null
      : { limit: daySeconds, period: "day", seconds: daySeconds - usedToday };

  const month: CallTimeLeft | null =
    monthSeconds === undefined
      ? null
      : { limit: monthSeconds, period: "month", seconds: monthSeconds - usedThisMonth };

  if (!day || (month && (month.seconds <= 0 || month.seconds <= day.seconds))) {
    return month;
  }

  return day;
}

function findCallTimeLimit({ counts, kind, tier }: UsageClaim): AllowanceLimit | null {
  const left = getCallTimeLeft({
    kind,
    tier,
    usedThisMonth: counts.secondsThisMonth,
    usedToday: counts.secondsToday,
  });

  if (!left || left.seconds > 0) {
    return null;
  }

  return { limit: left.limit, period: left.period, resource: "callSeconds", tier };
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

  const callTime = findCallTimeLimit(claim);

  if (callTime) {
    return callTime;
  }

  const budget = getDailySpendBudgetMicros(claim.tier);
  const spent = claim.counts.spentTodayMicros;

  // A call starts while any budget is left and always runs whole; the budget refuses the next one.
  const overBudget =
    claim.kind === "conversation" ? spent >= budget : spent + claim.costMicros > budget;

  if (claim.costMicros > 0 && overBudget) {
    return { limit: budget, period: "day", resource: "aiSpend", tier: claim.tier };
  }

  return null;
}

function getFairUseWaitSeconds({ counts, kind, now, tier }: UsageClaim): number | null {
  const { fairUseDay } = getUsageRule({ kind, tier });

  if (fairUseDay === undefined || counts.day < fairUseDay || !counts.lastUsedAt) {
    return null;
  }

  const elapsedSeconds = (now.getTime() - counts.lastUsedAt.getTime()) / MS_PER_SECOND;
  const waitSeconds = Math.ceil(FAIR_USE_SPACING_SECONDS - elapsedSeconds);

  return waitSeconds > 0 ? waitSeconds : null;
}

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
