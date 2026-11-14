import { UsageKind } from "@zoonk/db";
import { type Allowance, type AllowanceItem, type EntitlementTier } from "../contract";
import { getActiveGoalLimit, getExamPrepAccess, getUsageRule } from "../limits";
import { getUsageAvailableAt } from "./rolling-usage";
import { type UsageTotals, getUsageCounts } from "./usage-counts";
import { getUsageResets } from "./usage-periods";

type Usage = { day: number; rolling: number; total: number };

function getRemaining({
  item,
  usage,
}: {
  item: { dailyLimit: number | null; rollingLimit: number | null; totalLimit: number | null };
  usage: Usage;
}) {
  const left = [
    item.dailyLimit === null ? null : item.dailyLimit - usage.day,
    item.rollingLimit === null ? null : item.rollingLimit - usage.rolling,
    item.totalLimit === null ? null : item.totalLimit - usage.total,
  ].filter((value) => value !== null);

  return left.length === 0 ? null : Math.max(0, Math.min(...left));
}

function getItemUsage(kind: UsageKind, used: ReturnType<typeof getUsageCounts>): Usage {
  if (kind === "conversation") {
    return { day: used.secondsToday, rolling: used.secondsLast30Days, total: used.total };
  }

  return {
    day: used.day,
    rolling: kind === "lessonStart" ? used.lessonStarts.count : used.usedLast30Days,
    total: used.total,
  };
}

function toAllowanceItem({
  kind,
  now,
  tier,
  totals,
}: {
  kind: UsageKind;
  now: Date;
  tier: EntitlementTier;
  totals: UsageTotals;
}): AllowanceItem {
  const rule = getUsageRule({ kind, tier });
  const used = getUsageCounts(totals, kind);
  const usage = getItemUsage(kind, used);

  const common = {
    dailyLimit: (kind === "conversation" ? rule.daySeconds : rule.day) ?? null,
    fairUseDailyLimit: rule.fairUseDay ?? null,
    totalLimit: rule.total ?? null,
    usedToday: usage.day,
    usedTotal: usage.total,
  };

  const remaining = getRemaining({
    item: { ...common, rollingLimit: rule.rolling30Days ?? null },
    usage,
  });

  const rollingLimit = rule.rolling30Days ?? null;
  const usedLast30Days = kind === "lessonStart" ? totals.lessonStarts.count : usage.rolling;

  const availableAt = getUsageAvailableAt({ counts: used, kind, now, tier });

  return {
    ...common,
    availableAt,
    kind,
    remaining: kind === "conversation" && availableAt ? 0 : remaining,
    rollingLimit,
    usedLast30Days,
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

  return {
    activeGoals: { limit: getActiveGoalLimit(tier), used: totals.activeGoals },
    examPrep: getExamPrepAccess(tier),
    generatedLessons:
      generatedLimit === undefined
        ? null
        : { limit: generatedLimit, used: totals.kinds.get("lessonStart")?.generatedTotal ?? 0 },
    items: Object.values(UsageKind).map((kind) => toAllowanceItem({ kind, now, tier, totals })),
    resets: getUsageResets(now),
    tier,
  };
}
