import "server-only";
import { STAFF_PROPOSE_SCOPE } from "@zoonk/auth/cli-login-contract";
import { type ContentFixStatus, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getStaffActor } from "../get-staff-actor";
import { StaffInputError, parseStaffInput } from "../input";
import { closeProposed } from "./_utils/close-proposed";
import { logContentFix } from "./_utils/content-fix-view";
import { batchOf, batchWhere, getContentFixBatchReviewUrl } from "./batches";
import { contentFixWithdrawalSchema } from "./contract";

type Target = { batchId?: string; fixId?: string };

type Withdrawal =
  | { message: string; status: "invalid" | "notFound" | "notProposer" | "nothingToWithdraw" }
  | {
      batchId: string;
      fixes: { id: string; status: ContentFixStatus }[];
      status: "withdrawn";
      /** How many fixes this request withdrew; a repeat finds none left. */
      withdrawn: number;
    };

type WithdrawResult = Withdrawal | { status: "forbidden" | "missingScope" | "unauthorized" };

function targetName({ batchId, fixId }: Target): string {
  return fixId ? `ContentFix ${fixId}` : `batch ${batchId ?? ""}`;
}

function revertCommand({ batchId, fixId }: Target): string {
  return `pnpm zoonk staff fixes revert ${fixId ?? `--batch ${batchId ?? ""}`} --reason "…"`;
}

/** Why nothing could be withdrawn, and what undoes a fix that's past review. */
function nothingWaits({
  fixes,
  target,
}: {
  fixes: readonly { status: ContentFixStatus }[];
  target: Target;
}): string {
  const counts = [...Map.groupBy(fixes, (fix) => fix.status)]
    .map(([status, entries]) => `${String(entries.length)} ${status}`)
    .join(", ");

  const statuses = new Set(fixes.map((fix) => fix.status));

  return [
    `Nothing in ${targetName(target)} waits for review (${counts}), so nothing was withdrawn.`,
    statuses.has("applied") && `To undo what applied, propose a revert: ${revertCommand(target)}.`,
    statuses.has("approved") &&
      "An approved fix finishes applying in Admin; once it's applied, propose a revert.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Withdraws the target's fixes that still wait for review and that this staff person proposed;
 * whatever an approver already decided keeps where it stands. Withdrawing what's already
 * withdrawn succeeds without changing anything.
 */
async function withdraw({ target, userId }: { target: Target; userId: string }) {
  const where = target.fixId ? { id: target.fixId } : batchWhere(target.batchId ?? "");

  const withdrawn = await closeProposed({
    status: "withdrawn",
    userId,
    where: { AND: [where, { proposerId: userId }] },
  });

  const fixes = await prisma.contentFix.findMany({
    orderBy: { id: "asc" },
    select: { batchId: true, id: true, proposerId: true, status: true },
    where,
  });

  const [first] = fixes;

  if (!first) {
    return { message: `No ${targetName(target)}.`, status: "notFound" } as const;
  }

  if (!fixes.some((fix) => fix.proposerId === userId)) {
    return {
      message: `Only the staff person who proposed ${targetName(target)} can withdraw it. To turn it down, reject it in Admin: ${getContentFixBatchReviewUrl(batchOf(first))}`,
      status: "notProposer",
    } as const;
  }

  if (!fixes.some((fix) => fix.status === "withdrawn")) {
    return { message: nothingWaits({ fixes, target }), status: "nothingToWithdraw" } as const;
  }

  return {
    batchId: batchOf(first),
    fixes: fixes.map((fix) => ({ id: fix.id, status: fix.status })),
    status: "withdrawn",
    withdrawn,
  } as const;
}

function withdrawOutcome(result: Withdrawal): string {
  if (result.status !== "withdrawn") {
    return result.status;
  }

  return result.withdrawn > 0 ? "withdrawn" : "unchanged";
}

async function readTarget(input: unknown): Promise<Target | { message: string }> {
  const { data, error } = await safeAsync(() => parseStaffInput(contentFixWithdrawalSchema, input));

  if (error instanceof StaffInputError) {
    return { message: error.message };
  }

  if (error || !data) {
    throw error;
  }

  return data;
}

/**
 * Takes back a proposal nobody approved yet, from the CLI login of the staff person who proposed
 * it: one fix, or every fix of a batch still waiting for review. Nothing changes in the content.
 */
export async function withdrawContentFixes(input: unknown): Promise<WithdrawResult> {
  const started = performance.now();
  const actor = await getStaffActor(STAFF_PROPOSE_SCOPE);

  if (actor.status !== "ready") {
    logContentFix({
      action: "withdraw",
      actorUserId: "userId" in actor ? actor.userId : null,
      outcome: actor.status,
      started,
    });

    return { status: actor.status };
  }

  const target = await readTarget(input);

  const result: Withdrawal =
    "message" in target
      ? { message: target.message, status: "invalid" }
      : await withdraw({ target, userId: actor.userId });

  logContentFix({
    action: "withdraw",
    actorUserId: actor.userId,
    batchId: result.status === "withdrawn" ? result.batchId : null,
    clientId: actor.clientId,
    fixId: "fixId" in target ? target.fixId : null,
    outcome: withdrawOutcome(result),
    started,
  });

  return result;
}
