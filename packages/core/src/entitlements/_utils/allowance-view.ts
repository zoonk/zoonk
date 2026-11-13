import { UsageKind } from "@zoonk/db";
import { type Allowance, type AllowanceItem, type EntitlementTier } from "../contract";
import { getActiveGoalLimit, getExamPrepAccess, getUsageRule } from "../limits";
import { getLessonAvailableAt } from "./lesson-start-usage";
import { type UsageTotals } from "./usage-counts";
import { getUsageResets } from "./usage-periods";

type Usage = { day: number; month: number; total: number };

function getRemaining({
  item,
  usage,
}: {
  item: { dailyLimit: number | null; monthlyLimit: number | null; totalLimit: number | null };
  usage: Usage;
}) {
  const left = [
    item.dailyLimit === null ? null : item.dailyLimit - usage.day,
    item.monthlyLimit === null ? null : item.monthlyLimit - usage.month,
    item.totalLimit === null ? null : item.totalLimit - usage.total,
  ].filter((value) => value !== null);

  return left.length === 0 ? null : Math.max(0, Math.min(...left));
}

function toAllowanceItem({
  kind,
  tier,
  totals,
}: {
  kind: UsageKind;
  tier: EntitlementTier;
  totals: UsageTotals;
}): AllowanceItem {
  const rule = getUsageRule({ kind, tier });
  const used = totals.kinds.get(kind);
  const usage = { day: used?.day ?? 0, month: used?.month ?? 0, total: used?.total ?? 0 };

  const common = {
    dailyLimit: rule.day ?? null,
    fairUseDailyLimit: rule.fairUseDay ?? null,
    totalLimit: rule.total ?? null,
    usedToday: usage.day,
    usedTotal: usage.total,
  };

  const remaining = getRemaining({ item: { ...common, monthlyLimit: rule.month ?? null }, usage });

  if (kind === "lessonStart") {
    const rollingLimit = rule.rolling30Days ?? null;

    return {
      ...common,
      availableAt: rollingLimit === null ? null : getLessonAvailableAt(totals.lessonStarts),
      kind,
      remaining:
        rollingLimit === null ? remaining : Math.max(0, rollingLimit - totals.lessonStarts.count),
      rollingLimit,
      usedLast30Days: totals.lessonStarts.count,
    };
  }

  return {
    ...common,
    kind,
    monthlyLimit: rule.month ?? null,
    remaining,
    usedThisMonth: usage.month,
  };
}

export function toAllowance({
  now,
  tier,
  totals,
}: {
  now: Date;
  tier: EntitlementTier;
  totals: UsageTotals;
}): Allowance {
  const generatedLimit = getUsageRule({ kind: "lessonStart", tier }).generatedTotal;
  const calls = getUsageRule({ kind: "conversation", tier });
  const callUsage = totals.kinds.get("conversation");

  return {
    activeGoals: { limit: getActiveGoalLimit(tier), used: totals.activeGoals },
    callTime: {
      limitSeconds: calls.daySeconds ?? null,
      monthLimitSeconds: calls.monthSeconds ?? null,
      usedSeconds: callUsage?.secondsToday ?? 0,
      usedSecondsThisMonth: callUsage?.secondsThisMonth ?? 0,
    },
    examPrep: getExamPrepAccess(tier),
    generatedLessons:
      generatedLimit === undefined
        ? null
        : { limit: generatedLimit, used: totals.kinds.get("lessonStart")?.generatedTotal ?? 0 },
    items: Object.values(UsageKind).map((kind) => toAllowanceItem({ kind, tier, totals })),
    resets: getUsageResets(now),
    tier,
  };
}
