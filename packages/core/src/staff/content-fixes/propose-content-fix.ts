import "server-only";
import { randomUUID } from "node:crypto";
import { STAFF_PROPOSE_SCOPE } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { unstable_rethrow } from "next/navigation";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { getStaffActor } from "../get-staff-actor";
import { StaffInputError, parseStaffInput } from "../input";
import { type ContentFixView, logContentFix, toContentFixView } from "./_utils/content-fix-view";
import {
  type ChangeResolver,
  type PreparedFix,
  inverseChange,
  prepareContentFix,
  proposedChange,
  targetsOf,
} from "./_utils/prepare-content-fix";
import { getStaffSessionUser } from "./_utils/staff-session";
import { getContentFixBatchReviewUrl } from "./batches";
import {
  contentFixChangesSchema,
  contentFixProposalSchema,
  contentFixRevertSchema,
} from "./contract";

type ProposeResult =
  | { status: "error" | "forbidden" | "missingScope" | "unauthorized" }
  | { message: string; status: "invalid" | "notFound" }
  | { batchId: string; fixes: ContentFixView[]; reviewUrl: string; status: "proposed" };

type Actor = { clientId: string; userId: string };

type ProposedFix = {
  changes: readonly ChangeResolver[];
  feedbackId?: string | null;
  reason: string;
  revertsId?: string;
};

type Prepared = { fix: PreparedFix; proposal: ProposedFix };

function label({ count, index }: { count: number; index: number }): string {
  return count > 1 ? `fixes[${String(index)}]: ` : "";
}

function writtenKeys(fix: PreparedFix): Set<string> {
  return new Set(
    fix.changes.flatMap((change) =>
      targetsOf(change).map(({ id, model, part }) => `${model} ${id} ${part}`),
    ),
  );
}

function sharedKey({
  index,
  written,
}: {
  index: number;
  written: readonly Set<string>[];
}): { earlier: number; key: string } | null {
  const keys = [...(written[index] ?? [])];
  const earlier = written.slice(0, index).findIndex((other) => keys.some((key) => other.has(key)));
  const key = keys.find((candidate) => written[earlier]?.has(candidate));

  return earlier === -1 || !key ? null : { earlier, key };
}

/** A later fix of the batch writing what an earlier one writes would always find it changed. */
function overlapProblems(prepared: readonly PreparedFix[]): string[] {
  const written = prepared.map((fix) => writtenKeys(fix));

  return written.flatMap((_, index) => {
    const shared = sharedKey({ index, written });

    return shared
      ? [
          `fixes[${String(index)}]: fixes[${String(shared.earlier)}] also changes ${shared.key}; put both in one fix.`,
        ]
      : [];
  });
}

async function feedbackProblems(proposals: readonly ProposedFix[]): Promise<string[]> {
  const ids = [...new Set(proposals.flatMap((proposal) => proposal.feedbackId ?? []))];

  const found =
    ids.length > 0
      ? await prisma.feedback.findMany({ select: { id: true }, where: { id: { in: ids } } })
      : [];

  const known = new Set(found.map((feedback) => feedback.id));

  return proposals.flatMap((proposal, index) =>
    proposal.feedbackId && !known.has(proposal.feedbackId)
      ? [`${label({ count: proposals.length, index })}No Feedback with id ${proposal.feedbackId}.`]
      : [],
  );
}

async function prepareBatch(
  proposals: readonly ProposedFix[],
): Promise<{ prepared: Prepared[] } | { problems: string[] }> {
  const results = await Promise.all(
    proposals.map((proposal) => prepareContentFix(prisma, proposal.changes)),
  );

  const prepared = results.flatMap((result, index) => {
    const proposal = proposals[index];
    return result.ok && proposal ? [{ fix: result.fix, proposal }] : [];
  });

  const problems = [
    ...results.flatMap((result, index) =>
      result.ok ? [] : [`${label({ count: proposals.length, index })}${result.problem}`],
    ),
    ...(prepared.length === proposals.length
      ? overlapProblems(prepared.map((entry) => entry.fix))
      : []),
    ...(await feedbackProblems(proposals)),
  ];

  return problems.length > 0 ? { problems } : { prepared };
}

/** Every fix of a batch is checked before any is stored, so a batch is proposed whole or not at all. */
async function saveBatch(actor: Actor, proposals: readonly ProposedFix[]): Promise<ProposeResult> {
  const batch = await prepareBatch(proposals);

  if ("problems" in batch) {
    return { message: batch.problems.join("\n"), status: "invalid" };
  }

  const batchId = randomUUID();
  const now = new Date();

  const fixes = await prisma.$transaction(async (tx) => {
    const created = await tx.contentFix.createManyAndReturn({
      data: batch.prepared.map(({ fix, proposal }) => ({
        batchId,
        changes: fix.changes,
        effects: fix.effects,
        feedbackId: proposal.feedbackId,
        proposerClientId: actor.clientId,
        proposerId: actor.userId,
        reason: proposal.reason,
        revertsId: proposal.revertsId,
        unit: fix.unit.kind,
        unitId: fix.unit.id,
        voiceOwedAt: fix.effects.some((effect) => effect.kind === "voiceOwed") ? now : null,
      })),
    });

    await oweFollowUps({
      db: tx,
      followUps: created.flatMap((fix) =>
        fix.voiceOwedAt ? [{ input: { fixId: fix.id }, kind: "voiceContentFix" as const }] : [],
      ),
      userId: actor.userId,
    });

    return created;
  });

  return {
    batchId,
    fixes: fixes.map((fix) => toContentFixView(fix)),
    reviewUrl: getContentFixBatchReviewUrl(batchId),
    status: "proposed",
  };
}

async function findApplied(input: { batchId?: string; fixId?: string }) {
  const fixes = await prisma.contentFix.findMany({
    orderBy: { id: "asc" },
    select: {
      changes: true,
      id: true,
      revertedBy: {
        select: { id: true },
        take: 1,
        where: { status: { in: ["proposed", "approved", "applied"] } },
      },
      status: true,
    },
    where: input.fixId ? { id: input.fixId } : { batchId: input.batchId ?? "" },
  });

  const name = input.fixId ? `ContentFix with id ${input.fixId}` : `batch ${input.batchId ?? ""}`;
  const applied = fixes.filter((fix) => fix.status === "applied");

  const wanted = input.fixId ? applied : applied.filter((fix) => fix.revertedBy.length === 0);

  if (fixes.length === 0) {
    return { message: `No ${name}.`, status: "notFound" as const };
  }

  if (applied.length === 0) {
    return {
      message: `Only an applied fix can be reverted; nothing in ${name} is applied.`,
      status: "invalid" as const,
    };
  }

  if (wanted.length === 0) {
    return {
      message: `Every applied fix in ${name} is already reverted or has a revert waiting for review.`,
      status: "invalid" as const,
    };
  }

  return { applied: wanted, status: "found" as const };
}

async function buildRevert(input: {
  batchId?: string;
  fixId?: string;
  reason: string;
}): Promise<BuiltProposal> {
  const found = await findApplied(input);

  if (found.status !== "found") {
    return found;
  }

  return {
    proposals: found.applied.map((original) => ({
      changes: contentFixChangesSchema
        .parse(original.changes)
        .map((change) => inverseChange(change)),
      reason: input.reason,
      revertsId: original.id,
    })),
  };
}

async function buildProposal(body: unknown): Promise<BuiltProposal> {
  const proposal = await parseStaffInput(contentFixProposalSchema, body);
  const fixes = proposal.fixes ?? [{ changes: proposal.changes ?? [] }];

  return {
    proposals: fixes.map((fix) => ({
      changes: fix.changes.map((change) => proposedChange(change)),
      feedbackId: fix.feedbackId ?? proposal.feedbackId,
      reason: fix.reason ?? proposal.reason,
    })),
  };
}

type BuiltProposal =
  | { message: string; status: "invalid" | "notFound" }
  | { proposals: ProposedFix[] };

type Proposer =
  | { status: "forbidden" | "missingScope" | "unauthorized"; userId?: string }
  | (Actor & { status: "ready" });

function getCliProposer(): Promise<Proposer> {
  return getStaffActor(STAFF_PROPOSE_SCOPE);
}

/** What `ContentFix.proposerClientId` holds for a revert a staff person started in Admin. */
const ADMIN_PROPOSER = "admin";

async function getAdminProposer(): Promise<Proposer> {
  const staff = await getStaffSessionUser();
  return staff.status === "ready" ? { ...staff, clientId: ADMIN_PROPOSER } : staff;
}

async function runProposal({
  action,
  getProposer = getCliProposer,
  input,
  toProposal,
}: {
  action: "propose" | "revert";
  getProposer?: () => Promise<Proposer>;
  input: unknown;
  toProposal: (input: unknown) => Promise<BuiltProposal>;
}): Promise<ProposeResult> {
  const started = performance.now();
  const { data: actor, error: actorError } = await safeAsync(getProposer);

  if (actorError) {
    unstable_rethrow(actorError);
  }

  if (!actor) {
    logContentFix({ action, actorUserId: null, outcome: "error", started });
    return { status: "error" };
  }

  if (actor.status !== "ready") {
    logContentFix({ action, actorUserId: actor.userId ?? null, outcome: actor.status, started });

    return { status: actor.status };
  }

  const log = (outcome: string, batchId?: string) =>
    logContentFix({
      action,
      actorUserId: actor.userId,
      batchId,
      clientId: actor.clientId,
      outcome,
      started,
    });

  const { data: result, error } = await safeAsync(async (): Promise<ProposeResult> => {
    const built = await toProposal(input);
    return "proposals" in built ? saveBatch(actor, built.proposals) : built;
  });

  if (error instanceof StaffInputError) {
    log("invalid");
    return { message: error.message, status: "invalid" };
  }

  if (error || !result) {
    log("error");
    throw error;
  }

  log(result.status, result.status === "proposed" ? result.batchId : undefined);
  return result;
}

/**
 * Stores a staff person's proposed fixes for review, from a CLI login allowed to propose. Nothing
 * changes until someone approves them in Admin with a passkey.
 */
export function proposeContentFix(input: unknown): Promise<ProposeResult> {
  return runProposal({ action: "propose", input, toProposal: buildProposal });
}

/**
 * Proposes putting back what an applied fix replaced, or what every applied fix of a batch
 * replaced, as a new batch reviewed like any other.
 */
export function proposeContentFixRevert(input: unknown): Promise<ProposeResult> {
  return runProposal({
    action: "revert",
    input,
    toProposal: async (body) => buildRevert(await parseStaffInput(contentFixRevertSchema, body)),
  });
}

/**
 * Admin's Revert: the same reviewed proposal, from the signed-in staff person's session instead of
 * a CLI login. It changes nothing until someone approves it with a passkey.
 */
export function proposeContentFixRevertInAdmin(input: {
  fixId: string;
  reason: string;
}): Promise<ProposeResult> {
  return runProposal({
    action: "revert",
    getProposer: getAdminProposer,
    input,
    toProposal: async (body) => buildRevert(await parseStaffInput(contentFixRevertSchema, body)),
  });
}
