import "server-only";
import { type UsageKind, prisma } from "@zoonk/db";
import { io } from "next/cache";
import { type AllowanceLimit, type EntitlementTier, type UsageDecision } from "../contract";
import { getEstimatedCostMicros } from "../limits";
import { evaluateUsage } from "./evaluate-usage";
import { countUsage } from "./usage-counts";

type UsageCheck = { kind: UsageKind; tier: EntitlementTier; userId: string };

async function evaluateUsageNow({
  costMicros,
  kind,
  tier,
  userId,
}: UsageCheck & { costMicros: number }): Promise<UsageDecision> {
  await io();
  const now = new Date();
  const counts = await countUsage({ client: prisma, kind, now, userId });

  return evaluateUsage({ costMicros, counts, generated: false, kind, now, tier });
}

/** Fresh permission check without consuming usage; returns null while capacity remains. */
export async function findReachedUsageLimit(check: UsageCheck): Promise<AllowanceLimit | null> {
  const decision = await evaluateUsageNow({ ...check, costMicros: 0 });

  return decision.status === "limitReached" ? decision.limit : null;
}

/** What a claim made now would answer, without consuming usage. */
export function previewUsageClaim(check: UsageCheck): Promise<UsageDecision> {
  const costMicros = getEstimatedCostMicros({ generated: false, kind: check.kind, seconds: 0 });

  return evaluateUsageNow({ ...check, costMicros });
}
