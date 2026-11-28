import "server-only";
import { type UsageKind, prisma } from "@zoonk/db";
import { getEstimatedCostMicros } from "../limits";
import { type EntitlementViewer } from "./entitlement-viewer";
import { evaluateUsage } from "./evaluate-usage";
import { fitsGuestSpend, readGuestSpentMicros } from "./guest-spend-budget";
import { countUsage } from "./usage-counts";

export async function canStartUsage({
  kind,
  now,
  viewer,
}: {
  kind: UsageKind;
  now: Date;
  viewer: EntitlementViewer;
}): Promise<boolean> {
  const generated = false;
  const costMicros = getEstimatedCostMicros({ generated, kind });
  const checksGuestSpend = viewer.isGuest && costMicros > 0;

  const [counts, spentMicros] = await Promise.all([
    countUsage({ client: prisma, kind, now, userId: viewer.userId }),
    checksGuestSpend ? readGuestSpentMicros(now) : 0,
  ]);

  return (
    evaluateUsage({ costMicros, counts, generated, kind, now, tier: viewer.tier }).status ===
      "allowed" &&
    (!checksGuestSpend || fitsGuestSpend({ costMicros, spentMicros }))
  );
}
