import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type TransactionClient } from "@zoonk/db";
import { writePlanInputs } from "../../../library/_utils/plan-input-write";
import { type StoredChange, contentFixChangesSchema } from "../contract";
import { applyFixChanges, lockFixPlans, lockFixRows } from "./apply-content-fix";
import { changedSince } from "./changed-since";
import { prepareContentFix, storedChange } from "./prepare-content-fix";
import { type FixUnit } from "./resolved-change";

const STALE_CONTENT =
  "The content changed after this fix was proposed. Propose it again from what's there now.";

async function staleReasonFor(
  tx: TransactionClient,
  {
    fixId,
    reverts,
    stored,
  }: { fixId: string; reverts: { decidedAt: Date | null } | null; stored: StoredChange[] },
): Promise<string | null> {
  if (reverts?.decidedAt && (await changedSince(tx, { fixId, since: reverts.decidedAt, stored }))) {
    return STALE_CONTENT;
  }

  const fresh = await prepareContentFix(
    tx,
    stored.map((change) => storedChange(change)),
  );

  if (!fresh.ok) {
    return fresh.problem;
  }

  return isDeepStrictEqual(fresh.fix.changes, stored) ? null : STALE_CONTENT;
}

type Applied = { status: "applied"; unit: FixUnit } | { status: "stale" } | null;

/**
 * Claims one approved fix and applies it in its own transaction: it applies only while every row
 * still holds the `before` the fix recorded and the rules still accept it, and otherwise ends
 * stale with nothing written. Null when another request claimed it first.
 */
export function applyApprovedFix({
  deciderId,
  fixId,
}: {
  deciderId: string;
  fixId: string;
}): Promise<Applied> {
  return writePlanInputs(async (tx): Promise<Applied> => {
    const { count } = await tx.contentFix.updateMany({
      data: { decidedAt: new Date(), status: "applied" },
      where: { deciderId, id: fixId, status: "approved" },
    });

    if (count === 0) {
      return null;
    }

    const fix = await tx.contentFix.findUniqueOrThrow({
      select: { changes: true, reverts: { select: { decidedAt: true } }, unit: true, unitId: true },
      where: { id: fixId },
    });

    const changes = contentFixChangesSchema.parse(fix.changes);
    const unit = { id: fix.unitId, kind: fix.unit };

    await lockFixPlans(tx, changes);
    await lockFixRows(tx, { changes, unit });

    const now = new Date();

    // Fixes that waited on these locks are ordered by when they applied, not when they were claimed.
    await tx.contentFix.update({ data: { decidedAt: now }, where: { id: fixId } });

    const staleReason = await staleReasonFor(tx, { fixId, reverts: fix.reverts, stored: changes });

    if (staleReason) {
      await tx.contentFix.update({ data: { staleReason, status: "stale" }, where: { id: fixId } });
      return { status: "stale" };
    }

    await applyFixChanges(tx, { changes, context: { fixId, now }, unit });
    return { status: "applied", unit };
  });
}
