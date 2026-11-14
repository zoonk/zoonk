import { type TransactionClient, UsageKind, sql } from "@zoonk/db";
import { type EntitlementTier } from "../contract";
import {
  FAIR_USE_SPACING_SECONDS,
  FREE_LESSON_LIMIT,
  USAGE_WINDOW_MS,
  getActiveGoalLimit,
  getCallMonthlyBudgetMicros,
  getDailySpendBudgetMicros,
  getEstimatedCostMicros,
  getRollingClaimReadLimit,
  getUsageRule,
} from "../limits";
import { type UsageCounts } from "./usage-counts";
import { getUsageResets } from "./usage-periods";

type RollingClaim = { at: Date; amount: number };
type RollingKind = UsageKind | "lessonPreparation";
type RollingUsage = { count: number; seconds: number; claims: RollingClaim[] };

export async function loadRollingUsage({
  client,
  now,
  userId,
}: {
  client: TransactionClient;
  now: Date;
  userId: string;
}): Promise<Map<RollingKind, RollingUsage>> {
  const caps = Object.values(UsageKind).map(
    (kind) => sql`(${kind}, ${getRollingClaimReadLimit(kind)}::int)`,
  );

  caps.push(sql`(${"lessonPreparation"}, ${FREE_LESSON_LIMIT}::int)`);

  const cutoff = new Date(now.getTime() - USAGE_WINDOW_MS);

  const rows = await client.$queryRaw<
    { kind: RollingKind; at: Date; seconds: number; count: bigint; totalSeconds: bigint }[]
  >(sql`
 WITH caps(kind,cap) AS (VALUES ${caps.reduce((joined, cap, index) => (index === 0 ? cap : sql`${joined},${cap}`))}), records AS (
 SELECT CASE kind::text WHEN 'lesson_start' THEN CASE WHEN counted_at IS NULL THEN 'lessonPreparation' ELSE 'lessonStart' END WHEN 'mind_map' THEN 'mindMap' WHEN 'mock_questions' THEN 'mockQuestions' WHEN 'tutor_message' THEN 'tutorMessage' ELSE kind::text END AS kind,
 COALESCE(counted_at,created_at) AS at, seconds, id
 FROM usage_records WHERE user_id=${userId}::uuid AND
 ((kind='lesson_start' AND (counted_at>${cutoff} OR (counted_at IS NULL AND created_at>${cutoff}))) OR (kind<>'lesson_start' AND created_at>${cutoff}))
 ), ranked AS (
 SELECT *, COUNT(*) OVER(PARTITION BY kind) AS count,
 SUM(seconds) OVER(PARTITION BY kind) AS "totalSeconds",
 ROW_NUMBER() OVER(PARTITION BY kind, (kind='conversation' AND seconds>0) ORDER BY at DESC,id DESC) AS position
 FROM records
 ) SELECT ranked.kind, at, seconds, count, "totalSeconds" FROM ranked JOIN caps USING(kind)
 WHERE position<=cap AND (kind<>'conversation' OR seconds>0 OR position=1)
 ORDER BY at DESC
 `);

  const result = new Map<RollingKind, RollingUsage>();

  for (const row of rows) {
    const usage = result.get(row.kind) ?? {
      claims: [],
      count: Number(row.count),
      seconds: Number(row.totalSeconds),
    };

    if (row.kind !== "conversation" || row.seconds > 0) {
      usage.claims.push({ amount: row.kind === "conversation" ? row.seconds : 1, at: row.at });
    }

    result.set(row.kind, usage);
  }

  return result;
}

function getRollingAvailableAt({
  claims,
  limit,
  required = 1,
}: {
  claims: readonly RollingClaim[];
  limit: number;
  required?: number;
}): Date | null {
  if (required > limit) {
    return null;
  }

  let used = 0;

  for (const claim of claims) {
    used += claim.amount;

    if (used > limit - required) {
      return new Date(claim.at.getTime() + USAGE_WINDOW_MS);
    }
  }

  return null;
}

function getCallAvailableAt({ counts, now, tier }: UsageOpeningInput): Date {
  const rule = getUsageRule({ kind: "conversation", tier });
  const budget = getCallMonthlyBudgetMicros(tier);

  const timeAt =
    rule.rolling30Days === undefined
      ? null
      : getRollingAvailableAt({ claims: counts.rollingClaims, limit: rule.rolling30Days });

  const moneyAt = getRollingAvailableAt({ claims: counts.callSpend, limit: budget });

  const opening = [timeAt, moneyAt].reduce<Date>(
    (latest, date) => (date && date > latest ? date : latest),
    now,
  );

  const dayFull =
    (rule.daySeconds !== undefined && counts.secondsToday >= rule.daySeconds) ||
    counts.spentTodayMicros >= getDailySpendBudgetMicros(tier);

  return afterDailyOpening(opening, dayFull, now);
}

function afterDailyOpening(opening: Date, blocked: boolean, now: Date): Date {
  const day = getUsageResets(now).day;
  return blocked && day > opening ? day : opening;
}

type UsageOpeningInput = {
  counts: UsageCounts;
  kind: UsageKind;
  now: Date;
  tier: EntitlementTier;
  required?: number;
  preparing?: boolean;
  costMicros?: number;
  generatedCount?: number;
};

export function getUsageOpening({
  counts,
  kind,
  now,
  tier,
  required = 1,
  preparing = false,
  costMicros,
  generatedCount = 0,
}: UsageOpeningInput): Date | null {
  if (kind === "conversation" && getCallMonthlyBudgetMicros(tier) === 0) {
    return null;
  }

  if (kind === "conversation") {
    return getCallAvailableAt({ counts, kind, now, tier });
  }

  const rule = getUsageRule({ kind, tier });

  const budget = getDailySpendBudgetMicros(tier);

  const cost =
    costMicros ?? (kind === "lessonStart" ? 0 : getEstimatedCostMicros({ generated: true, kind }));

  if (cannotOpen({ costMicros: cost, counts, generatedCount, kind, now, required, tier })) {
    return null;
  }

  const claims =
    kind === "lessonStart"
      ? [...counts.lessonStarts.latest, ...(preparing ? counts.lessonStarts.latestPrepared : [])]
          .toSorted((a, b) => b.getTime() - a.getTime())
          .map((at) => ({ amount: 1, at }))
      : counts.rollingClaims;

  const opening =
    rule.rolling30Days === undefined
      ? now
      : (getRollingAvailableAt({ claims, limit: rule.rolling30Days, required }) ?? now);

  const dayFull =
    (rule.day !== undefined && counts.day + required > rule.day) ||
    (cost > 0 && counts.spentTodayMicros + cost > budget);

  const afterDay = afterDailyOpening(opening, dayFull, now);

  const fairUseAt = getFairUseOpening({ counts, kind, now, required, tier });

  return fairUseAt > afterDay ? fairUseAt : afterDay;
}

function getFairUseOpening({ counts, kind, now, required = 1, tier }: UsageOpeningInput): Date {
  const { fairUseDay } = getUsageRule({ kind, tier });

  if (fairUseDay !== undefined && required > 1 && counts.day + required > fairUseDay) {
    return getUsageResets(now).day;
  }

  if (fairUseDay === undefined || counts.day < fairUseDay || !counts.lastUsedAt) {
    return now;
  }

  return new Date(
    Math.min(
      counts.lastUsedAt.getTime() + FAIR_USE_SPACING_SECONDS * 1000,
      getUsageResets(now).day.getTime(),
    ),
  );
}

export function getUsageAvailableAt(input: UsageOpeningInput): Date | null {
  const { counts, kind, preparing = false, required = 1, tier } = input;
  const rule = getUsageRule({ kind, tier });
  const used = getRollingUsed({ counts, kind, preparing });

  const rollingFull =
    rule.rolling30Days !== undefined &&
    used + (kind === "conversation" ? 1 : required) > rule.rolling30Days;

  const moneyFull =
    kind === "conversation" &&
    counts.callSpend.reduce((sum, row) => sum + row.amount, 0) >= getCallMonthlyBudgetMicros(tier);

  return rollingFull || moneyFull ? getUsageOpening(input) : null;
}

function getRollingUsed({
  counts,
  kind,
  preparing = false,
}: Pick<UsageOpeningInput, "counts" | "kind" | "preparing">): number {
  if (kind === "conversation") {
    return counts.secondsLast30Days;
  }

  if (kind === "lessonStart") {
    return counts.lessonStarts.count + (preparing ? counts.lessonStarts.prepared : 0);
  }

  return counts.usedLast30Days;
}

function cannotOpen({
  counts,
  kind,
  tier,
  required = 1,
  generatedCount = 0,
  costMicros = 0,
}: UsageOpeningInput): boolean {
  const rule = getUsageRule({ kind, tier });
  const activeGoalLimit = kind === "goal" ? getActiveGoalLimit(tier) : null;

  return (
    (activeGoalLimit !== null && counts.activeGoals >= activeGoalLimit) ||
    (rule.total !== undefined && counts.total + required > rule.total) ||
    (rule.generatedTotal !== undefined &&
      counts.generatedTotal + generatedCount > rule.generatedTotal) ||
    (rule.rolling30Days !== undefined && required > rule.rolling30Days) ||
    (rule.day !== undefined && required > rule.day) ||
    (rule.fairUseDay !== undefined && required > rule.fairUseDay) ||
    costMicros > getDailySpendBudgetMicros(tier)
  );
}
