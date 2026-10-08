import { UsageKind } from "@zoonk/db";
import { type Allowance, type AllowanceItem, type EntitlementTier } from "../contract";
import { getActiveGoalLimit, getExamPrepAccess, getUsageRule } from "../limits";
import { getUsageResets } from "./usage-periods";

export type AllowanceCounts = {
  activeGoals: number;
  callSecondsThisMonth: number;
  callSecondsToday: number;
  day: Map<UsageKind, number>;
  generatedLessons: number;
  month: Map<UsageKind, number>;
  total: Map<UsageKind, number>;
};

type Usage = { day: number; month: number; total: number };

function getRemaining({ item, usage }: { item: Omit<AllowanceItem, "remaining">; usage: Usage }) {
  const left = [
    item.dailyLimit === null ? null : item.dailyLimit - usage.day,
    item.monthlyLimit === null ? null : item.monthlyLimit - usage.month,
    item.totalLimit === null ? null : item.totalLimit - usage.total,
  ].filter((value) => value !== null);

  return left.length === 0 ? null : Math.max(0, Math.min(...left));
}

function toAllowanceItem({
  counts,
  kind,
  tier,
}: {
  counts: AllowanceCounts;
  kind: UsageKind;
  tier: EntitlementTier;
}): AllowanceItem {
  const rule = getUsageRule({ kind, tier });

  const usage = {
    day: counts.day.get(kind) ?? 0,
    month: counts.month.get(kind) ?? 0,
    total: counts.total.get(kind) ?? 0,
  };

  const item = {
    dailyLimit: rule.day ?? null,
    fairUseDailyLimit: rule.fairUseDay ?? null,
    kind,
    monthlyLimit: rule.month ?? null,
    totalLimit: rule.total ?? null,
    usedThisMonth: usage.month,
    usedToday: usage.day,
    usedTotal: usage.total,
  };

  return { ...item, remaining: getRemaining({ item, usage }) };
}

/** Builds what the learner sees about their plan from the same rules claims are judged by. */
export function toAllowance({
  counts,
  now,
  tier,
}: {
  counts: AllowanceCounts;
  now: Date;
  tier: EntitlementTier;
}): Allowance {
  const generatedLimit = getUsageRule({ kind: "lessonStart", tier }).generatedTotal;
  const calls = getUsageRule({ kind: "conversation", tier });

  return {
    activeGoals: { limit: getActiveGoalLimit(tier), used: counts.activeGoals },
    callTime: {
      limitSeconds: calls.daySeconds ?? null,
      monthLimitSeconds: calls.monthSeconds ?? null,
      usedSeconds: counts.callSecondsToday,
      usedSecondsThisMonth: counts.callSecondsThisMonth,
    },
    examPrep: getExamPrepAccess(tier),
    generatedLessons:
      generatedLimit === undefined
        ? null
        : { limit: generatedLimit, used: counts.generatedLessons },
    items: Object.values(UsageKind).map((kind) => toAllowanceItem({ counts, kind, tier })),
    resets: getUsageResets(now),
    tier,
  };
}
