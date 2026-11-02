import "server-only";
import { type UsageKind, prisma } from "@zoonk/db";
import { io } from "next/cache";
import { type AllowanceLimit, type EntitlementTier } from "../contract";
import { evaluateUsage } from "./evaluate-usage";
import { countUsage } from "./usage-counts";

/** Fresh permission check without consuming usage; returns null while capacity remains. */
export async function findReachedUsageLimit({
  kind,
  tier,
  userId,
}: {
  kind: UsageKind;
  tier: EntitlementTier;
  userId: string;
}): Promise<AllowanceLimit | null> {
  await io();
  const now = new Date();
  const counts = await countUsage({ client: prisma, kind, now, userId });
  const decision = evaluateUsage({ costMicros: 0, counts, generated: false, kind, now, tier });

  return decision.status === "limitReached" ? decision.limit : null;
}
