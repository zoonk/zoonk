import { type UsageKind } from "@zoonk/db";
import { type AllowanceLimit, type EntitlementTier, type UsageDecision } from "../contract";
import {
  FAIR_USE_SPACING_SECONDS,
  getActiveGoalLimit,
  getCallMonthlyBudgetMicros,
  getDailySpendBudgetMicros,
  getUsageRule,
} from "../limits";
import { getUsageAvailableAt } from "./rolling-usage";
import { type UsageCounts } from "./usage-counts";

const MS_PER_SECOND = 1000;

type UsageClaim = {
  costMicros: number;
  counts: UsageCounts;
  generated: boolean;
  seconds?: number;
  preparing?: boolean;
  kind: UsageKind;
  now: Date;
  tier: EntitlementTier;
};

type LimitCheck = Omit<AllowanceLimit, "availableAt" | "period" | "tier"> & {
  period: "day" | "total";
  used: number;
};

function getLimitChecks({ counts, generated, kind, tier }: UsageClaim): LimitCheck[] {
  const rule = getUsageRule({ kind, tier });
  const activeGoalLimit = kind === "goal" ? getActiveGoalLimit(tier) : null;

  // The rolling cap comes first: pausing a goal cannot make room in that window.
  // Otherwise, offer pausing a followed goal before waiting for the daily cap.
  const checks: (LimitCheck | false)[] = [
    activeGoalLimit !== null && {
      limit: activeGoalLimit,
      period: "total",
      resource: "activeGoals",
      used: counts.activeGoals,
    },
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
  ];

  return checks.filter((check): check is LimitCheck => check !== false);
}

export type CallTimeLeft = { limit: number; period: "day" | "rolling30Days"; seconds: number };

/** Null means uncapped. */
export function getCallTimeLeft({
  kind,
  tier,
  usedLast30Days,
  usedToday,
}: {
  kind: UsageKind;
  tier: EntitlementTier;
  usedLast30Days: number;
  usedToday: number;
}): CallTimeLeft | null {
  if (kind !== "conversation") {
    return null;
  }

  const { daySeconds, rolling30Days } = getUsageRule({ kind, tier });

  const day: CallTimeLeft | null =
    daySeconds === undefined
      ? null
      : { limit: daySeconds, period: "day", seconds: daySeconds - usedToday };

  const rolling: CallTimeLeft | null =
    rolling30Days === undefined
      ? null
      : { limit: rolling30Days, period: "rolling30Days", seconds: rolling30Days - usedLast30Days };

  if (!day || (rolling && (rolling.seconds <= 0 || rolling.seconds <= day.seconds))) {
    return rolling;
  }

  return day;
}

function findCallTimeLimit({
  counts,
  kind,
  tier,
  seconds,
  costMicros,
  now,
}: UsageClaim): AllowanceLimit | null {
  const left = getCallTimeLeft({
    kind,
    tier,
    usedLast30Days: counts.secondsLast30Days,
    usedToday: counts.secondsToday,
  });

  if (!left || left.seconds > 0) {
    return null;
  }

  return {
    ...(left.period === "rolling30Days" && {
      availableAt: getUsageAvailableAt({ costMicros, counts, kind, now, seconds, tier }),
    }),
    limit: left.limit,
    period: left.period,
    resource: "callSeconds",
    tier,
  };
}

function findReachedLimit(claim: UsageClaim): AllowanceLimit | null {
  const rollingLimit =
    claim.kind === "conversation" ? undefined : getUsageRule(claim).rolling30Days;

  if (
    rollingLimit !== undefined &&
    (claim.kind === "lessonStart"
      ? claim.counts.lessonStarts.count + (claim.preparing ? claim.counts.lessonStarts.prepared : 0)
      : claim.counts.usedLast30Days) >= rollingLimit
  ) {
    return {
      availableAt: getUsageAvailableAt(claim),
      limit: rollingLimit,
      period: "rolling30Days",
      resource: claim.preparing ? "lessonPreparation" : claim.kind,
      tier: claim.tier,
    };
  }

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

  if (claim.kind === "conversation") {
    const limit = getCallMonthlyBudgetMicros(claim.tier);

    const availableAt = getUsageAvailableAt(claim);

    if (claim.counts.callSpend.reduce((sum, row) => sum + row.amount, 0) >= limit) {
      return { availableAt, limit, period: "rolling30Days", resource: "aiSpend", tier: claim.tier };
    }
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
