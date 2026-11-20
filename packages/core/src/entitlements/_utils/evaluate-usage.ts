import { type UsageKind } from "@zoonk/db";
import { type AllowanceLimit, type EntitlementTier, type UsageDecision } from "../contract";
import {
  FAIR_USE_SPACING_SECONDS,
  getActiveGoalLimit,
  getCallMonthlyBudgetMicros,
  getDailySpendBudgetMicros,
  getUsageRule,
} from "../limits";
import { getRollingLimitOpening, getUsageAvailableAt } from "./rolling-usage";
import { type UsageCounts } from "./usage-counts";
import { getUsageResets } from "./usage-periods";

const MS_PER_SECOND = 1000;

type UsageClaim = {
  costMicros: number;
  counts: UsageCounts;
  generated: boolean;
  preparing?: boolean;
  required?: number;
  kind: UsageKind;
  now: Date;
  tier: EntitlementTier;
};

type LimitCheck = Omit<AllowanceLimit, "availableAt" | "tier"> & { used: number };

function getLimitChecks({ counts, generated, kind, required = 1, tier }: UsageClaim): LimitCheck[] {
  const rule = getUsageRule({ kind, tier });
  const activeGoalLimit = kind === "goal" ? getActiveGoalLimit(tier) : null;

  // A rolling goal cap outranks goals followed: pausing one cannot clear that window.
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
      used: counts.total + required - 1,
    },
    generated &&
      rule.generatedTotal !== undefined && {
        limit: rule.generatedTotal,
        period: "total",
        resource: "generatedLessons",
        used: counts.generatedTotal + required - 1,
      },
    rule.day !== undefined && {
      limit: rule.day,
      period: "day",
      resource: kind,
      used: counts.day + required - 1,
    },
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

function getCallLimitChecks({ counts, kind, tier }: UsageClaim): LimitCheck[] {
  if (kind !== "conversation") {
    return [];
  }

  const rule = getUsageRule({ kind, tier });
  const budget = getCallMonthlyBudgetMicros(tier);

  const checks: (LimitCheck | false)[] = [
    rule.rolling30Days !== undefined && {
      limit: rule.rolling30Days,
      period: "rolling30Days",
      resource: "callSeconds",
      used: counts.secondsLast30Days,
    },
    budget > 0 && {
      limit: budget,
      period: "rolling30Days",
      resource: "aiSpend",
      used: counts.callSpend.reduce((sum, row) => sum + row.amount, 0),
    },
    rule.daySeconds !== undefined && {
      limit: rule.daySeconds,
      period: "day",
      resource: "callSeconds",
      used: counts.secondsToday,
    },
  ];

  return checks.filter((check): check is LimitCheck => check !== false);
}

function findDailySpendLimit(claim: UsageClaim): AllowanceLimit | null {
  const budget = getDailySpendBudgetMicros(claim.tier);
  const spent = claim.counts.spentTodayMicros;
  // A call starts while any budget is left and always runs whole; the budget refuses the next one.
  const overBudget =
    claim.kind === "conversation" ? spent >= budget : spent + claim.costMicros > budget;

  return claim.costMicros > 0 && overBudget
    ? { limit: budget, period: "day", resource: "aiSpend", tier: claim.tier }
    : null;
}

function getReachedLimits(claim: UsageClaim): AllowanceLimit[] {
  const rule = getUsageRule(claim);

  const rolling: LimitCheck[] =
    claim.kind !== "conversation" && rule.rolling30Days !== undefined
      ? [
          {
            limit: rule.rolling30Days,
            period: "rolling30Days",
            resource: claim.preparing ? "lessonPreparation" : claim.kind,
            used:
              (claim.required ?? 1) -
              1 +
              (claim.kind === "lessonStart"
                ? claim.counts.lessonStarts.count +
                  (claim.preparing ? claim.counts.lessonStarts.prepared : 0)
                : claim.counts.usedLast30Days),
          },
        ]
      : [];

  const limits = [...rolling, ...getLimitChecks(claim), ...getCallLimitChecks(claim)]
    .filter((check) => check.used >= check.limit)
    .map(({ limit, period, resource }) => ({ limit, period, resource, tier: claim.tier }));

  const spend = findDailySpendLimit(claim);
  return spend ? [...limits, spend] : limits;
}

function findReachedLimit(claim: UsageClaim): AllowanceLimit | null {
  const limits = getReachedLimits(claim);
  const rolling = limits.find((limit) => limit.period === "rolling30Days");

  if (!rolling) {
    return limits.find((limit) => limit.period === "total") ?? limits[0] ?? null;
  }

  const availableAt = getUsageAvailableAt(claim);

  if (!availableAt) {
    return { ...rolling, availableAt: null };
  }

  const temporal = limits.filter((limit) => limit.period !== "total");

  const last = temporal.reduce(
    (latest, limit) => (limitOpening(limit, claim) > limitOpening(latest, claim) ? limit : latest),
    rolling,
  );

  return { ...last, availableAt };
}

function limitOpening(limit: AllowanceLimit, claim: UsageClaim): number {
  return limit.period === "day"
    ? getUsageResets(claim.now).day.getTime()
    : (getRollingLimitOpening({
        ...claim,
        limit: limit.limit,
        resource: limit.resource,
      })?.getTime() ?? Number.POSITIVE_INFINITY);
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
