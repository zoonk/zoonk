import { type TransactionClient, UsageKind, sql } from "@zoonk/db";
import { type EntitlementTier } from "../contract";
import {
  FREE_LESSON_LIMIT,
  USAGE_WINDOW_MS,
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

function getCallAvailableAt({
  counts,
  now,
  tier,
  seconds = 1,
  costMicros = 1,
}: {
  counts: UsageCounts;
  now: Date;
  tier: EntitlementTier;
  seconds?: number;
  costMicros?: number;
}): Date | null {
  const rule = getUsageRule({ kind: "conversation", tier });
  const budget = getCallMonthlyBudgetMicros(tier);
  const duration = Math.max(1, seconds);
  const cost = Math.max(1, costMicros);

  if ((rule.rolling30Days !== undefined && duration > rule.rolling30Days) || cost > budget) {
    return null;
  }

  const timeAt =
    rule.rolling30Days === undefined
      ? null
      : getRollingAvailableAt({
          claims: counts.rollingClaims,
          limit: rule.rolling30Days,
          required: duration,
        });

  const moneyAt = getRollingAvailableAt({
    claims: counts.callSpend,
    limit: budget,
    required: cost,
  });

  const opening = [timeAt, moneyAt].reduce<Date | null>(
    (latest, date) => (date && (!latest || date > latest) ? date : latest),
    null,
  );

  const dayFull =
    (rule.daySeconds !== undefined && counts.secondsToday >= rule.daySeconds) ||
    counts.spentTodayMicros >= getDailySpendBudgetMicros(tier);

  return afterDailyOpening(opening, dayFull, now);
}

function afterDailyOpening(opening: Date | null, blocked: boolean, now: Date): Date | null {
  if (!opening) {
    return null;
  }

  const day = getUsageResets(now).day;
  return blocked && day > opening ? day : opening;
}

export function getUsageAvailableAt({
  counts,
  kind,
  now,
  tier,
  required = 1,
  preparing = false,
  costMicros,
  seconds,
}: {
  counts: UsageCounts;
  kind: UsageKind;
  now: Date;
  tier: EntitlementTier;
  required?: number;
  preparing?: boolean;
  costMicros?: number;
  seconds?: number;
}): Date | null {
  if (kind === "conversation") {
    return getCallAvailableAt({ costMicros, counts, now, seconds, tier });
  }

  const rule = getUsageRule({ kind, tier });

  if (rule.rolling30Days === undefined) {
    return null;
  }

  const claims =
    kind === "lessonStart"
      ? [...counts.lessonStarts.latest, ...(preparing ? counts.lessonStarts.latestPrepared : [])]
          .toSorted((a, b) => b.getTime() - a.getTime())
          .map((at) => ({ amount: 1, at }))
      : counts.rollingClaims;

  const opening = getRollingAvailableAt({ claims, limit: rule.rolling30Days, required });

  const cost =
    costMicros ?? (kind === "lessonStart" ? 0 : getEstimatedCostMicros({ generated: true, kind }));

  const dayFull =
    (rule.day !== undefined && counts.day >= rule.day) ||
    (cost > 0 && counts.spentTodayMicros + cost > getDailySpendBudgetMicros(tier));

  return afterDailyOpening(opening, dayFull, now);
}
