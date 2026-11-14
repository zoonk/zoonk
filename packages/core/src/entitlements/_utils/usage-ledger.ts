import { type TransactionClient, type UsageKind } from "@zoonk/db";
import { type AllowanceLimit, type UsageDecision } from "../contract";
import { FREE_LESSON_LIMIT, getEstimatedCostMicros } from "../limits";
import { type EntitlementViewer } from "./entitlement-viewer";
import { evaluateUsage } from "./evaluate-usage";
import { getUsageOpening } from "./rolling-usage";
import { type UsageTotals, addUsage, getUsageCounts, promotePreparedUsage } from "./usage-counts";

export type BundleClaim = { generated: boolean; kind: UsageKind; targetId: string };

type PricedClaim = BundleClaim & { costMicros: number; existing: boolean };

/**
 * Running usage for claims decided one after another in one request: the totals so far and the
 * targets already claimed, which are free again.
 */
export type UsageLedger = {
  claimed: ReadonlySet<string>;
  prepared: ReadonlyMap<string, Date>;
  now: Date;
  totals: UsageTotals;
  viewer: EntitlementViewer;
};

function toClaimKey({ kind, targetId }: Pick<BundleClaim, "kind" | "targetId">): string {
  return `${kind}:${targetId}`;
}

/** The targets of `claims` the learner already claimed. */
export async function findClaimedTargets({
  claims,
  client,
  userId,
}: {
  claims: readonly BundleClaim[];
  client: TransactionClient;
  userId: string;
}): Promise<{ claimed: Set<string>; prepared: Map<string, Date> }> {
  const byKind = Map.groupBy(claims, (claim) => claim.kind);

  const rows =
    claims.length === 0
      ? []
      : await client.usageRecord.findMany({
          select: { countedAt: true, createdAt: true, kind: true, targetId: true },
          where: {
            OR: [...byKind].map(([kind, ofKind]) => ({
              kind,
              targetId: { in: ofKind.map((claim) => claim.targetId) },
            })),
            userId,
          },
        });

  return {
    claimed: new Set(
      rows
        .filter((row) => row.kind !== "lessonStart" || row.countedAt !== null)
        .map((row) => toClaimKey(row)),
    ),
    prepared: new Map(
      rows
        .filter((row) => row.kind === "lessonStart" && row.countedAt === null)
        .map((row) => [toClaimKey(row), row.createdAt]),
    ),
  };
}

type Decided = { decision: UsageDecision; recorded: PricedClaim[]; totals: UsageTotals };

/** Whether one more claim of a kind fits the allowance, as if its target were new. */
export function decideNewClaim({
  claim,
  ledger,
}: {
  claim: Omit<BundleClaim, "targetId">;
  ledger: UsageLedger;
}): UsageDecision {
  return evaluateUsage({
    costMicros: getEstimatedCostMicros(claim),
    counts: getUsageCounts(ledger.totals, claim.kind),
    generated: claim.generated,
    kind: claim.kind,
    now: ledger.now,
    tier: ledger.viewer.tier,
  });
}

function decideClaim({
  claim,
  decided,
  ledger,
}: {
  claim: BundleClaim;
  decided: Decided;
  ledger: UsageLedger;
}): Decided {
  if (decided.decision.status !== "allowed") {
    return decided;
  }

  const preparedAt = ledger.prepared.get(toClaimKey(claim));
  const costMicros = preparedAt ? 0 : getEstimatedCostMicros(claim);

  const decision = preparedAt
    ? { status: "allowed" as const }
    : decideNewClaim({ claim, ledger: { ...ledger, totals: decided.totals } });

  if (decision.status !== "allowed") {
    return { ...decided, decision };
  }

  return {
    decision,
    recorded: [...decided.recorded, { ...claim, costMicros, existing: preparedAt !== undefined }],
    totals: preparedAt
      ? promotePreparedUsage({ now: ledger.now, preparedAt, totals: decided.totals })
      : addUsage({ ...claim, costMicros, now: ledger.now, totals: decided.totals }),
  };
}

/**
 * Decides a bundle of claims, all or none, without writing: each new one counts the ones before
 * it, and one the learner already claimed is free. A refused bundle leaves the ledger as it was.
 */
export function decideBundle({
  claims,
  ledger,
}: {
  claims: readonly BundleClaim[];
  ledger: UsageLedger;
}): { decision: UsageDecision; ledger: UsageLedger; recorded: PricedClaim[] } {
  const fresh = [
    ...new Map(
      claims
        .filter((claim) => !ledger.claimed.has(toClaimKey(claim)))
        .map((claim) => [toClaimKey(claim), claim]),
    ).values(),
  ];

  const lessons = fresh.filter((claim) => claim.kind === "lessonStart").length;

  if (ledger.viewer.tier === "free" && lessons > FREE_LESSON_LIMIT) {
    return {
      decision: {
        limit: {
          availableAt: null,
          limit: FREE_LESSON_LIMIT,
          period: "total",
          resource: "chapterLessons",
          tier: "free",
        },
        status: "limitReached",
      },
      ledger,
      recorded: [],
    };
  }

  if (
    ledger.viewer.tier === "free" &&
    lessons > 0 &&
    ledger.totals.lessonStarts.count + lessons > FREE_LESSON_LIMIT
  ) {
    return {
      decision: { limit: getBundleLimit({ fresh, ledger }), status: "limitReached" },
      ledger,
      recorded: [],
    };
  }

  const decided = fresh.reduce<Decided>(
    (sofar, claim) => decideClaim({ claim, decided: sofar, ledger }),
    { decision: { status: "allowed" }, recorded: [], totals: ledger.totals },
  );

  if (decided.decision.status !== "allowed") {
    const decision =
      decided.decision.status === "limitReached" &&
      (decided.decision.limit.period === "rolling30Days" ||
        decided.decision.limit.availableAt !== undefined)
        ? { ...decided.decision, limit: getBundleLimit({ fresh, ledger }) }
        : decided.decision;

    return { decision, ledger, recorded: [] };
  }

  return {
    decision: decided.decision,
    ledger: {
      ...ledger,
      claimed: new Set([...ledger.claimed, ...decided.recorded.map((claim) => toClaimKey(claim))]),
      totals: decided.totals,
    },
    recorded: decided.recorded,
  };
}

function getBundleLimit({
  fresh,
  ledger,
}: {
  fresh: readonly BundleClaim[];
  ledger: UsageLedger;
}): AllowanceLimit {
  const costMicros = fresh.reduce(
    (sum, claim) =>
      sum + (ledger.prepared.has(toClaimKey(claim)) ? 0 : getEstimatedCostMicros(claim)),
    0,
  );

  const checked = [...Map.groupBy(fresh, (claim) => claim.kind)].flatMap(([kind, claims]) => {
    const unprepared = claims.filter((claim) => !ledger.prepared.has(toClaimKey(claim)));

    const required =
      kind === "lessonStart" && ledger.viewer.tier === "free" ? claims.length : unprepared.length;

    if (required === 0) {
      return [];
    }

    const input = {
      costMicros,
      counts: getUsageCounts(ledger.totals, kind),
      generated: unprepared.some((claim) => claim.generated),
      generatedCount: unprepared.filter((claim) => claim.generated).length,
      kind,
      now: ledger.now,
      required,
      tier: ledger.viewer.tier,
    };

    const decision = evaluateUsage(input);
    return [{ decision, opening: getUsageOpening(input) }];
  });

  const limits = checked.flatMap(({ decision, opening }) =>
    decision.status === "limitReached" ? [{ limit: decision.limit, opening }] : [],
  );

  const selected = limits.reduce((latest, next) =>
    (next.opening?.getTime() ?? Number.POSITIVE_INFINITY) >
    (latest.opening?.getTime() ?? Number.POSITIVE_INFINITY)
      ? next
      : latest,
  );

  const availableAt = checked.some(({ opening }) => opening === null)
    ? null
    : checked.reduce<Date>(
        (latest, { opening }) => (opening && opening > latest ? opening : latest),
        ledger.now,
      );

  const limit: AllowanceLimit =
    selected.limit.resource === "lessonStart"
      ? { ...selected.limit, resource: "chapterLessons" }
      : selected.limit;

  return limit.period === "total" ? limit : { ...limit, availableAt };
}
