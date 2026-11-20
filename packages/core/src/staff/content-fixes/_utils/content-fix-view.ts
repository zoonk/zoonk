import { type ContentFix } from "@zoonk/db";
import { logInfo } from "@zoonk/utils/logger";
import { getContentFixReviewUrl } from "../batches";
import { contentFixChangesSchema, contentFixEffectsSchema } from "../contract";
import { contentFixVoiceSchema } from "../voice-schema";
import { type PreparedFix } from "./prepare-content-fix";

export function describePreparedFix({
  fix,
  proposal,
}: {
  fix: PreparedFix;
  proposal: { feedbackId?: string | null; reason: string };
}) {
  const { unit, ...prepared } = fix;

  return {
    ...prepared,
    feedbackId: proposal.feedbackId ?? null,
    reason: proposal.reason,
    unit: unit.kind,
    unitId: unit.id,
  };
}

export function toContentFixView(fix: ContentFix) {
  return {
    batchId: fix.batchId,
    changes: contentFixChangesSchema.parse(fix.changes),
    effects: contentFixEffectsSchema.parse(fix.effects),
    feedbackId: fix.feedbackId,
    id: fix.id,
    reason: fix.reason,
    revertsId: fix.revertsId,
    reviewUrl: getContentFixReviewUrl(fix.id),
    staleReason: fix.staleReason,
    status: fix.status,
    unit: fix.unit,
    unitId: fix.unitId,
    voice: contentFixVoiceSchema.nullable().parse(fix.voice),
    voiceOwed: fix.voiceOwedAt !== null,
  };
}

export type ContentFixView = ReturnType<typeof toContentFixView>;

/** One line per proposal or decision: who, which fix and what happened, never the content itself. */
export function logContentFix(entry: {
  action: "apply" | "approve" | "check" | "propose" | "reject" | "resume" | "revert" | "withdraw";
  actorUserId: string | null;
  batchId?: string | null;
  clientId?: string | null;
  fixId?: string | null;
  outcome: string;
  started: number;
}) {
  logInfo(
    JSON.stringify({
      action: entry.action,
      actorUserId: entry.actorUserId,
      batchId: entry.batchId ?? null,
      clientId: entry.clientId ?? null,
      durationMs: Math.round(performance.now() - entry.started),
      event: "staff.contentFix",
      fixId: entry.fixId ?? null,
      outcome: entry.outcome,
    }),
  );
}
