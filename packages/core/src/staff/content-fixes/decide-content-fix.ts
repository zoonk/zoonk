import "server-only";
import { createPasskeyApprovalOptions, verifyPasskeyApproval } from "@zoonk/auth/passkey-approval";
import {
  type PasskeyApprovalOptions,
  type PasskeyAssertion,
} from "@zoonk/auth/passkey-approval-contract";
import { type ContentFixStatus, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCourseContent } from "../../cache/revalidate-course-content";
import { applyApprovedFix } from "./_utils/apply-approved-fix";
import { getFixCacheTags } from "./_utils/apply-content-fix";
import { logContentFix } from "./_utils/content-fix-view";
import { cacheUnits } from "./_utils/fix-cache-units";
import { type FixUnit } from "./_utils/resolved-change";
import { type StaffSessionRefusal, getStaffSessionUser } from "./_utils/staff-session";
import { MAX_BATCH_FIXES, batchWhere } from "./batches";

type Refused = StaffSessionRefusal | { status: "notFound" };

type ContentFixOutcome = { id: string; staleReason: string | null; status: ContentFixStatus };

type Decided = {
  /** Whether Main heard about the changes: false means it shows the old content until its cache expires. */
  cacheNotified: boolean | null;
  fixes: ContentFixOutcome[];
  status: "decided";
};

export type ContentFixDecision =
  | Refused
  | Decided
  | { status: "approvalExpired" | "assertionInvalid" };

function readOutcomes(batchId: string): Promise<ContentFixOutcome[]> {
  return prisma.contentFix.findMany({
    orderBy: { id: "asc" },
    select: { id: true, staleReason: true, status: true },
    where: batchWhere(batchId),
  });
}

/**
 * Whether the signed-in staff person can approve fixes yet (approving needs a passkey), and who
 * they are, so a page offers to finish only the fixes they approved.
 */
export async function getStaffPasskeyStatus(): Promise<
  Refused | { hasPasskey: boolean; status: "ready"; userId: string }
> {
  const decider = await getStaffSessionUser();

  if (decider.status !== "ready") {
    return decider;
  }

  const passkeys = await prisma.passkey.count({ where: { userId: decider.userId } });
  return { hasPasskey: passkeys > 0, status: "ready", userId: decider.userId };
}

function isSelection(fixIds: readonly string[]): boolean {
  return fixIds.length > 0 && fixIds.length <= MAX_BATCH_FIXES && fixIds.every((id) => isUuid(id));
}

/**
 * Starts approving the selected fixes of a batch: one single-use challenge, stored on exactly
 * those fixes, that one of the approver's own passkeys signs with user verification. Asking again
 * replaces it. `changed` means the selection no longer matches the batch's proposed fixes, so the
 * approver reads the page again before signing.
 */
export async function getContentFixApprovalOptions({
  batchId,
  fixIds,
}: {
  batchId: string;
  fixIds: readonly string[];
}): Promise<
  | Refused
  | { status: "changed" | "needsPasskey" }
  | { options: PasskeyApprovalOptions; status: "ready" }
> {
  const decider = await getStaffSessionUser();

  if (decider.status !== "ready") {
    return decider;
  }

  const selected = [...new Set(fixIds)];

  if (!isUuid(batchId) || !isSelection(selected)) {
    return { status: "notFound" };
  }

  const options = await createPasskeyApprovalOptions(decider.userId);

  if (!options) {
    return { status: "needsPasskey" };
  }

  const challenged = await prisma.$transaction(async (tx) => {
    const cleared = { approvalChallenge: null, approvalExpiresAt: null };
    const proposed = { ...batchWhere(batchId), status: "proposed" as const };

    await tx.contentFix.updateMany({ data: cleared, where: proposed });

    const { count } = await tx.contentFix.updateMany({
      data: {
        approvalChallenge: options.challenge,
        approvalExpiresAt: new Date(Date.now() + options.timeout),
      },
      where: { ...proposed, id: { in: selected } },
    });

    if (count !== selected.length) {
      await tx.contentFix.updateMany({ data: cleared, where: proposed });
    }

    return count === selected.length;
  });

  return challenged ? { options, status: "ready" } : { status: "changed" };
}

async function notifyApps(units: readonly FixUnit[]): Promise<boolean> {
  const { error } = await safeAsync(async () => {
    const tags = await Promise.all(units.map((unit) => getFixCacheTags(unit)));
    await revalidateCourseContent([...new Set(tags.flat())]);
  });

  if (error) {
    logError("Applied content fixes couldn't refresh the apps' caches", error);
  }

  return !error;
}

async function applyOne({
  batchId,
  deciderId,
  fixId,
}: {
  batchId: string;
  deciderId: string;
  fixId: string;
}): Promise<FixUnit[]> {
  const started = performance.now();
  const { data, error } = await safeAsync(() => applyApprovedFix({ deciderId, fixId }));

  if (error) {
    logError("An approved content fix couldn't apply; resuming the batch tries it again", error);
  }

  const outcome = error ? "error" : (data?.status ?? "skipped");
  logContentFix({ action: "apply", actorUserId: deciderId, batchId, fixId, outcome, started });

  if (data?.status !== "applied") {
    return [];
  }

  return cacheUnits(data);
}

async function applyInOrder({
  batchId,
  deciderId,
  fixIds,
}: {
  batchId: string;
  deciderId: string;
  fixIds: readonly string[];
}): Promise<FixUnit[]> {
  const [fixId, ...rest] = fixIds;

  if (!fixId) {
    return [];
  }

  const unit = await applyOne({ batchId, deciderId, fixId });
  const later = await applyInOrder({ batchId, deciderId, fixIds: rest });

  return [...unit, ...later];
}

/**
 * Applies the batch's fixes this approver approved, one transaction each and in proposal order,
 * so a later fix sees what an earlier one wrote. One that fails stays approved for a resume.
 */
async function applyApproved({
  batchId,
  deciderId,
}: {
  batchId: string;
  deciderId: string;
}): Promise<Decided> {
  const approved = await prisma.contentFix.findMany({
    orderBy: { id: "asc" },
    select: { id: true },
    where: { ...batchWhere(batchId), deciderId, status: "approved" },
  });

  const units = await applyInOrder({ batchId, deciderId, fixIds: approved.map((fix) => fix.id) });

  return {
    cacheNotified: units.length > 0 ? await notifyApps(units) : null,
    fixes: await readOutcomes(batchId),
    status: "decided",
  };
}

async function approve({
  assertion,
  batchId,
  deciderId,
}: {
  assertion: PasskeyAssertion;
  batchId: string;
  deciderId: string;
}): Promise<ContentFixDecision> {
  const [pending] = await prisma.contentFix.findMany({
    select: { approvalChallenge: true, approvalExpiresAt: true },
    take: 1,
    where: { ...batchWhere(batchId), approvalChallenge: { not: null }, status: "proposed" },
  });

  if (!pending?.approvalChallenge) {
    return applyApproved({ batchId, deciderId });
  }

  const now = new Date();

  if (!pending.approvalExpiresAt || pending.approvalExpiresAt <= now) {
    return { status: "approvalExpired" };
  }

  const verified = await verifyPasskeyApproval({
    assertion,
    expectedChallenge: pending.approvalChallenge,
    userId: deciderId,
  });

  if (!verified) {
    return { status: "assertionInvalid" };
  }

  await prisma.contentFix.updateMany({
    data: { approvalChallenge: null, approvalExpiresAt: null, deciderId, status: "approved" },
    where: {
      ...batchWhere(batchId),
      approvalChallenge: pending.approvalChallenge,
      approvalExpiresAt: { gt: now },
      status: "proposed",
    },
  });

  return applyApproved({ batchId, deciderId });
}

function outcomeOf(result: ContentFixDecision): string {
  if (result.status !== "decided") {
    return result.status;
  }

  return [...new Set(result.fixes.map((fix) => fix.status))].toSorted().join(",");
}

function decideAs({
  batchId,
  decider,
  run,
}: {
  batchId: string;
  decider: Awaited<ReturnType<typeof getStaffSessionUser>>;
  run: (deciderId: string) => Promise<ContentFixDecision>;
}): Promise<ContentFixDecision> {
  if (decider.status !== "ready") {
    return Promise.resolve(decider);
  }

  return isUuid(batchId) ? run(decider.userId) : Promise.resolve({ status: "notFound" });
}

async function decide({
  action,
  batchId,
  run,
}: {
  action: "approve" | "resume";
  batchId: string;
  run: (deciderId: string) => Promise<ContentFixDecision>;
}): Promise<ContentFixDecision> {
  const started = performance.now();
  const decider = await getStaffSessionUser();

  const result = await decideAs({ batchId, decider, run });

  logContentFix({
    action,
    actorUserId: decider.status === "ready" ? decider.userId : null,
    batchId: isUuid(batchId) ? batchId : null,
    outcome: outcomeOf(result),
    started,
  });

  return result;
}

/**
 * Approves the batch's fixes that hold the challenge `assertion` signed, when it's the signed-in
 * staff person's own passkey on Admin's page, then applies each: it applies only while every row
 * still holds the `before` it recorded, and otherwise ends stale. A repeat returns what was
 * decided.
 */
export function approveContentFixes({
  assertion,
  batchId,
}: {
  assertion: PasskeyAssertion;
  batchId: string;
}): Promise<ContentFixDecision> {
  return decide({
    action: "approve",
    batchId,
    run: (deciderId) => approve({ assertion, batchId, deciderId }),
  });
}

/**
 * Applies what the same staff person already approved with a passkey but didn't finish applying,
 * such as after a crash. No other fix can join, so it needs no new passkey.
 */
export function resumeContentFixes(batchId: string): Promise<ContentFixDecision> {
  return decide({
    action: "resume",
    batchId,
    run: (deciderId) => applyApproved({ batchId, deciderId }),
  });
}

/** Rejecting one fix needs a staff session but no passkey, since it changes no content. */
export async function rejectContentFix(fixId: string): Promise<ContentFixDecision> {
  const started = performance.now();
  const decider = await getStaffSessionUser();

  if (decider.status !== "ready") {
    logContentFix({ action: "reject", actorUserId: null, outcome: decider.status, started });
    return decider;
  }

  if (isUuid(fixId)) {
    await prisma.contentFix.updateMany({
      data: {
        approvalChallenge: null,
        approvalExpiresAt: null,
        decidedAt: new Date(),
        deciderId: decider.userId,
        status: "rejected",
      },
      where: { id: fixId, status: "proposed" },
    });
  }

  const fix = isUuid(fixId)
    ? await prisma.contentFix.findUnique({
        select: { id: true, staleReason: true, status: true },
        where: { id: fixId },
      })
    : null;

  const result: ContentFixDecision = fix
    ? { cacheNotified: null, fixes: [fix], status: "decided" }
    : { status: "notFound" };

  logContentFix({
    action: "reject",
    actorUserId: decider.userId,
    fixId: fix?.id,
    outcome: fix?.status ?? "notFound",
    started,
  });

  return result;
}
