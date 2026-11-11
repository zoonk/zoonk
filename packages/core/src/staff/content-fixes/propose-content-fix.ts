import "server-only";
import { STAFF_PROPOSE_SCOPE } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { unstable_rethrow } from "next/navigation";
import { getStaffActor } from "../get-staff-actor";
import { StaffInputError, parseStaffInput } from "../input";
import { type ContentFixView, logContentFix, toContentFixView } from "./_utils/content-fix-view";
import { prepareContentFix } from "./_utils/prepare-content-fix";
import {
  type ProposedChange,
  contentFixChangesSchema,
  contentFixProposalSchema,
  contentFixRevertSchema,
} from "./contract";

type ProposeResult =
  | { status: "error" | "forbidden" | "missingScope" | "unauthorized" }
  | { message: string; status: "invalid" | "notFound" }
  | { fix: ContentFixView; status: "proposed" };

type Actor = { clientId: string; userId: string };

type Proposal = {
  changes: readonly ProposedChange[];
  feedbackId?: string | null;
  reason: string;
  revertsId?: string;
};

async function saveProposal(actor: Actor, proposal: Proposal): Promise<ProposeResult> {
  const prepared = await prepareContentFix(prisma, proposal.changes);

  if (!prepared.ok) {
    return { message: prepared.problem, status: "invalid" };
  }

  const feedback = proposal.feedbackId
    ? await prisma.feedback.findUnique({ select: { id: true }, where: { id: proposal.feedbackId } })
    : null;

  if (proposal.feedbackId && !feedback) {
    return { message: `No Feedback with id ${proposal.feedbackId}.`, status: "invalid" };
  }

  const fix = await prisma.contentFix.create({
    data: {
      changes: prepared.fix.changes,
      effects: prepared.fix.effects,
      feedbackId: feedback?.id,
      proposerClientId: actor.clientId,
      proposerId: actor.userId,
      reason: proposal.reason,
      revertsId: proposal.revertsId,
      unit: prepared.fix.unit.kind,
      unitId: prepared.fix.unit.id,
    },
  });

  return { fix: toContentFixView(fix), status: "proposed" };
}

async function buildRevert(input: { fixId: string; reason: string }) {
  const original = await prisma.contentFix.findUnique({ where: { id: input.fixId } });

  if (!original) {
    return { message: `No ContentFix with id ${input.fixId}.`, status: "notFound" as const };
  }

  if (original.status !== "applied") {
    return {
      message: `Only an applied fix can be reverted; this one is ${original.status}.`,
      status: "invalid" as const,
    };
  }

  const changes = contentFixChangesSchema.parse(original.changes);

  if (changes.some((change) => change.op !== "set")) {
    return {
      message: "A retired question or a detached picture can't be reverted with a fix yet.",
      status: "invalid" as const,
    };
  }

  const inverse = changes.flatMap((change): ProposedChange[] =>
    change.op === "set"
      ? [
          {
            id: change.id,
            model: change.model,
            set: Object.fromEntries(change.fields.map((field) => [field.field, field.before])),
          },
        ]
      : [],
  );

  return { proposal: { changes: inverse, reason: input.reason, revertsId: original.id } };
}

type BuiltProposal = { message: string; status: "invalid" | "notFound" } | { proposal: Proposal };

async function runProposal({
  action,
  input,
  toProposal,
}: {
  action: "propose" | "revert";
  input: unknown;
  toProposal: (input: unknown) => Promise<BuiltProposal>;
}): Promise<ProposeResult> {
  const started = performance.now();

  const { data: actor, error: actorError } = await safeAsync(() =>
    getStaffActor(STAFF_PROPOSE_SCOPE),
  );

  if (actorError) {
    unstable_rethrow(actorError);
  }

  if (!actor) {
    logContentFix({ action, actorUserId: null, outcome: "error", started });
    return { status: "error" };
  }

  if (actor.status !== "ready") {
    const actorUserId = "userId" in actor ? actor.userId : null;
    logContentFix({ action, actorUserId, outcome: actor.status, started });
    return { status: actor.status };
  }

  const log = (outcome: string, fixId?: string) =>
    logContentFix({
      action,
      actorUserId: actor.userId,
      clientId: actor.clientId,
      fixId,
      outcome,
      started,
    });

  const { data: result, error } = await safeAsync(async (): Promise<ProposeResult> => {
    const built = await toProposal(input);
    return "proposal" in built ? saveProposal(actor, built.proposal) : built;
  });

  if (error instanceof StaffInputError) {
    log("invalid");
    return { message: error.message, status: "invalid" };
  }

  if (error || !result) {
    log("error");
    throw error;
  }

  log(result.status, result.status === "proposed" ? result.fix.id : undefined);
  return result;
}

/**
 * Stores a staff person's proposed fix for review, from a CLI login allowed to propose. Nothing
 * changes until someone approves it in Admin with a passkey.
 */
export function proposeContentFix(input: unknown): Promise<ProposeResult> {
  return runProposal({
    action: "propose",
    input,
    toProposal: async (body) => ({
      proposal: await parseStaffInput(contentFixProposalSchema, body),
    }),
  });
}

/** Proposes putting back what an applied fix replaced, reviewed like any other fix. */
export function proposeContentFixRevert(input: unknown): Promise<ProposeResult> {
  return runProposal({
    action: "revert",
    input,
    toProposal: async (body) => buildRevert(await parseStaffInput(contentFixRevertSchema, body)),
  });
}
