import "server-only";
import { isDeepStrictEqual } from "node:util";
import { createPasskeyApprovalOptions, verifyPasskeyApproval } from "@zoonk/auth/passkey-approval";
import {
  type PasskeyApprovalOptions,
  type PasskeyAssertion,
} from "@zoonk/auth/passkey-approval-contract";
import { type ContentFixStatus, type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCourseContent } from "../../cache/revalidate-course-content";
import { writePlanInputs } from "../../library/_utils/plan-input-write";
import {
  applyFixChanges,
  getFixCacheTags,
  lockFixRows,
  lockRetiredItemPlans,
} from "./_utils/apply-content-fix";
import { changedSince } from "./_utils/changed-since";
import { logContentFix } from "./_utils/content-fix-view";
import { prepareContentFix, toProposedChanges } from "./_utils/prepare-content-fix";
import { type FixUnit } from "./_utils/resolved-change";
import { type StaffSessionRefusal, getStaffSessionUser } from "./_utils/staff-session";
import { type StoredChange, contentFixChangesSchema } from "./contract";

type Refused = StaffSessionRefusal | { status: "notFound" };

type Decided = {
  /** Whether Main heard about the change: false means it shows the old content until its cache expires. */
  cacheNotified: boolean | null;
  fix: { id: string; staleReason: string | null; status: ContentFixStatus };
  status: "decided";
};

export type ContentFixDecision =
  | Refused
  | Decided
  | { status: "approvalExpired" | "assertionInvalid" };

const STALE_CONTENT =
  "The content changed after this fix was proposed. Propose it again from what's there now.";

async function findFix(fixId: string) {
  return isUuid(fixId)
    ? prisma.contentFix.findUnique({
        select: {
          approvalChallenge: true,
          approvalExpiresAt: true,
          id: true,
          staleReason: true,
          status: true,
        },
        where: { id: fixId },
      })
    : null;
}

function recorded(fix: {
  id: string;
  staleReason: string | null;
  status: ContentFixStatus;
}): Decided {
  return { cacheNotified: null, fix, status: "decided" };
}

/** Whether the signed-in staff person can approve fixes yet: approving needs a passkey. */
export async function getStaffPasskeyStatus(): Promise<
  Refused | { hasPasskey: boolean; status: "ready" }
> {
  const decider = await getStaffSessionUser();

  if (decider.status !== "ready") {
    return decider;
  }

  const passkeys = await prisma.passkey.count({ where: { userId: decider.userId } });
  return { hasPasskey: passkeys > 0, status: "ready" };
}

/**
 * Starts approving one fix: a single-use challenge, stored on the fix, that one of the approver's
 * own passkeys signs with user verification. Asking again replaces the challenge.
 */
export async function getContentFixApprovalOptions(
  fixId: string,
): Promise<
  | Refused
  | Decided
  | { status: "needsPasskey" }
  | { options: PasskeyApprovalOptions; status: "ready" }
> {
  const decider = await getStaffSessionUser();

  if (decider.status !== "ready") {
    return decider;
  }

  const fix = await findFix(fixId);

  if (!fix) {
    return { status: "notFound" };
  }

  if (fix.status !== "proposed") {
    return recorded(fix);
  }

  const options = await createPasskeyApprovalOptions(decider.userId);

  if (!options) {
    return { status: "needsPasskey" };
  }

  const { count } = await prisma.contentFix.updateMany({
    data: {
      approvalChallenge: options.challenge,
      approvalExpiresAt: new Date(Date.now() + options.timeout),
    },
    where: { id: fix.id, status: "proposed" },
  });

  const current = count === 1 ? null : await findFix(fix.id);
  return current ? recorded(current) : { options, status: "ready" };
}

type Approval =
  | { claimed: false }
  | { claimed: true; staleReason: string; status: "stale" }
  | { claimed: true; status: "applied"; unit: FixUnit };

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

  const fresh = await prepareContentFix(tx, toProposedChanges(stored));

  if (!fresh.ok) {
    return fresh.problem;
  }

  return isDeepStrictEqual(fresh.fix.changes, stored) ? null : STALE_CONTENT;
}

/**
 * Claims the fix and applies it in one transaction: it applies only while every row still holds
 * the `before` the fix recorded and the rules still accept it, and otherwise ends stale with
 * nothing written.
 */
function applyApproval({
  challenge,
  deciderId,
  fixId,
}: {
  challenge: string;
  deciderId: string;
  fixId: string;
}): Promise<Approval> {
  return writePlanInputs(async (tx): Promise<Approval> => {
    const now = new Date();

    const { count } = await tx.contentFix.updateMany({
      data: {
        approvalChallenge: null,
        approvalExpiresAt: null,
        decidedAt: now,
        deciderId,
        status: "applied",
      },
      where: {
        approvalChallenge: challenge,
        approvalExpiresAt: { gt: now },
        id: fixId,
        status: "proposed",
      },
    });

    if (count === 0) {
      return { claimed: false };
    }

    const fix = await tx.contentFix.findUniqueOrThrow({
      select: { changes: true, reverts: { select: { decidedAt: true } }, unit: true, unitId: true },
      where: { id: fixId },
    });

    const changes = contentFixChangesSchema.parse(fix.changes);
    const unit = { id: fix.unitId, kind: fix.unit };

    await lockRetiredItemPlans(tx, changes);
    await lockFixRows(tx, { changes, unit });

    // Fixes that waited on these locks are ordered by when they applied, not when they were claimed.
    await tx.contentFix.update({ data: { decidedAt: new Date() }, where: { id: fixId } });

    const staleReason = await staleReasonFor(tx, { fixId, reverts: fix.reverts, stored: changes });

    if (staleReason) {
      await tx.contentFix.update({ data: { staleReason, status: "stale" }, where: { id: fixId } });
      return { claimed: true, staleReason, status: "stale" };
    }

    await applyFixChanges(tx, { changes, unit });
    return { claimed: true, status: "applied", unit };
  });
}

async function notifyApps(unit: FixUnit): Promise<boolean> {
  const { error } = await safeAsync(async () =>
    revalidateCourseContent(await getFixCacheTags(unit)),
  );

  if (error) {
    logError("An applied content fix couldn't refresh the apps' caches", error);
  }

  return !error;
}

async function approve({
  assertion,
  deciderId,
  fixId,
}: {
  assertion: PasskeyAssertion;
  deciderId: string;
  fixId: string;
}): Promise<ContentFixDecision> {
  const fix = await findFix(fixId);

  if (!fix) {
    return { status: "notFound" };
  }

  if (fix.status !== "proposed") {
    return recorded(fix);
  }

  if (!fix.approvalChallenge || !fix.approvalExpiresAt || fix.approvalExpiresAt <= new Date()) {
    return { status: "approvalExpired" };
  }

  const verified = await verifyPasskeyApproval({
    assertion,
    expectedChallenge: fix.approvalChallenge,
    userId: deciderId,
  });

  if (!verified) {
    return { status: "assertionInvalid" };
  }

  const approval = await applyApproval({
    challenge: fix.approvalChallenge,
    deciderId,
    fixId: fix.id,
  });

  if (!approval.claimed) {
    const current = await findFix(fix.id);

    return current && current.status !== "proposed"
      ? recorded(current)
      : { status: "approvalExpired" };
  }

  if (approval.status === "stale") {
    return recorded({ id: fix.id, staleReason: approval.staleReason, status: "stale" });
  }

  return {
    cacheNotified: await notifyApps(approval.unit),
    fix: { id: fix.id, staleReason: null, status: "applied" },
    status: "decided",
  };
}

function outcomeOf(result: ContentFixDecision): string {
  return result.status === "decided" ? result.fix.status : result.status;
}

/**
 * Applies a proposed fix when `assertion` is the signed-in staff person's own passkey signing this
 * fix's challenge on Admin's page. A repeat returns what was decided first.
 */
export async function approveContentFix({
  assertion,
  fixId,
}: {
  assertion: PasskeyAssertion;
  fixId: string;
}): Promise<ContentFixDecision> {
  const started = performance.now();
  const decider = await getStaffSessionUser();

  const result =
    decider.status === "ready"
      ? await approve({ assertion, deciderId: decider.userId, fixId })
      : decider;

  logContentFix({
    action: "approve",
    actorUserId: decider.status === "ready" ? decider.userId : null,
    fixId: isUuid(fixId) ? fixId : null,
    outcome: outcomeOf(result),
    started,
  });

  return result;
}

/** Rejecting needs a staff session but no passkey, since it changes no content. */
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

  const fix = await findFix(fixId);
  const result: ContentFixDecision = fix ? recorded(fix) : { status: "notFound" };

  logContentFix({
    action: "reject",
    actorUserId: decider.userId,
    fixId: fix?.id,
    outcome: outcomeOf(result),
    started,
  });

  return result;
}
