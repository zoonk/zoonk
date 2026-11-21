import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type TransactionClient } from "@zoonk/db";
import { writePlanInputs } from "../../../library/_utils/plan-input-write";
import { type StoredChange, contentFixChangesSchema } from "../contract";
import { type ContentFixMedia, readContentFixMedia } from "../media-schema";
import { applyFixChanges, lockFixPlans, lockFixRows } from "./apply-content-fix";
import { changedSince } from "./changed-since";
import { resolveContentFix, storedChange } from "./prepare-content-fix";
import { readyFixMedia } from "./ready-fix-media";
import { type FixUnit } from "./resolved-change";

const STALE_CONTENT =
  "The content changed after this fix was proposed. Propose it again from what's there now.";

async function staleReasonFor(
  tx: TransactionClient,
  {
    fixId,
    media,
    reverts,
    stored,
  }: {
    fixId: string;
    media: ContentFixMedia;
    reverts: { decidedAt: Date | null } | null;
    stored: StoredChange[];
  },
): Promise<string | null> {
  if (reverts?.decidedAt && (await changedSince(tx, { fixId, since: reverts.decidedAt, stored }))) {
    return STALE_CONTENT;
  }

  const fresh = await resolveContentFix(
    tx,
    stored.map((change) => storedChange(change)),
  );

  if (!fresh.ok) {
    return fresh.problem;
  }

  const expectedMedia = new Map(fresh.fix.media.map((need) => [need.key, need]));
  const reviewedMedia = new Map(media.map(({ need }) => [need.key, need]));

  return isDeepStrictEqual(fresh.fix.changes, stored) &&
    isDeepStrictEqual(expectedMedia, reviewedMedia)
    ? null
    : STALE_CONTENT;
}

type Applied =
  | { changes: StoredChange[]; status: "applied"; unit: FixUnit }
  | { status: "stale" }
  | null;

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
      select: {
        changes: true,
        media: true,
        reverts: { select: { decidedAt: true } },
        unit: true,
        unitId: true,
      },
      where: { id: fixId },
    });

    const changes = contentFixChangesSchema.parse(fix.changes);
    const media = readContentFixMedia(fix.media);
    const unit = { id: fix.unitId, kind: fix.unit };

    await lockFixPlans(tx, changes);
    await lockFixRows(tx, { changes, unit });

    const now = new Date();

    // Fixes that waited on these locks are ordered by when they applied, not when they were claimed.
    await tx.contentFix.update({ data: { decidedAt: now }, where: { id: fixId } });

    const staleReason = await staleReasonFor(tx, {
      fixId,
      media,
      reverts: fix.reverts,
      stored: changes,
    });

    const produced = staleReason ? null : await readyFixMedia(tx, media);

    if (!produced) {
      await tx.contentFix.update({
        data: {
          staleReason: staleReason ?? "The reviewed media changed. Propose the fix again.",
          status: "stale",
        },
        where: { id: fixId },
      });

      return { status: "stale" };
    }

    await applyFixChanges(tx, { changes, context: { fixId, media: produced, now }, unit });
    return { changes, status: "applied", unit };
  });
}
