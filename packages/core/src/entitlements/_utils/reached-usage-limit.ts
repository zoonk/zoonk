import "server-only";
import { type UsageKind, prisma } from "@zoonk/db";
import { type AllowanceLimit, type EntitlementTier } from "../contract";
import { evaluateUsage } from "./evaluate-usage";
import { countUsage } from "./usage-counts";

/**
 * The plan's cap on one kind of usage that the learner already reached, judged by the same rules
 * as a claim without counting a use; null while there's room. Uncached: it decides whether new
 * work starts.
 */
export async function findReachedUsageLimit({
  kind,
  tier,
  userId,
}: {
  kind: UsageKind;
  tier: EntitlementTier;
  userId: string;
}): Promise<AllowanceLimit | null> {
  const now = new Date();
  const counts = await countUsage({ client: prisma, kind, now, userId });
  const decision = evaluateUsage({ costMicros: 0, counts, generated: false, kind, now, tier });

  return decision.status === "limitReached" ? decision.limit : null;
}
