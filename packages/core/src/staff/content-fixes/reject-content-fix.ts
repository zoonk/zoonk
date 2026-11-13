import "server-only";
import { closeProposed } from "./_utils/close-proposed";
import { logContentFix } from "./_utils/content-fix-view";
import { type Decided, type Refused, decideAs, readOutcomes } from "./_utils/decision";
import { getStaffSessionUser } from "./_utils/staff-session";
import { batchWhere } from "./batches";

type Target = { batchId: string } | { fixId: string };

type Rejected = Decided & {
  /** How many fixes this request rejected; a repeat finds none left to reject. */
  rejected: number;
};

/**
 * Rejecting needs a staff session but no passkey, since it changes no content. It rejects only
 * what still waits for review: an approved, applied or stale fix keeps where it stands.
 */
async function rejectProposed({
  deciderId,
  target,
}: {
  deciderId: string;
  target: Target;
}): Promise<Refused | Rejected> {
  const where = "fixId" in target ? { id: target.fixId } : batchWhere(target.batchId);
  const rejected = await closeProposed({ status: "rejected", userId: deciderId, where });
  const fixes = await readOutcomes(where);

  return fixes.length > 0
    ? { cacheNotified: null, fixes, rejected, status: "decided" }
    : { status: "notFound" };
}

function rejectOutcome(result: Refused | Rejected): string {
  if (result.status !== "decided") {
    return result.status;
  }

  return result.rejected > 0 ? "rejected" : "unchanged";
}

async function reject(target: Target): Promise<Refused | Rejected> {
  const started = performance.now();
  const decider = await getStaffSessionUser();

  const result = await decideAs({
    decider,
    id: "fixId" in target ? target.fixId : target.batchId,
    run: (deciderId) => rejectProposed({ deciderId, target }),
  });

  logContentFix({
    action: "reject",
    actorUserId: decider.status === "ready" ? decider.userId : null,
    ...(result.status === "decided" ? target : {}),
    outcome: rejectOutcome(result),
    started,
  });

  return result;
}

export function rejectContentFix(fixId: string): Promise<Refused | Rejected> {
  return reject({ fixId });
}

/** Rejects every fix of a batch that still waits for review. */
export function rejectContentFixBatch(batchId: string): Promise<Refused | Rejected> {
  return reject({ batchId });
}
