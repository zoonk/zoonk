import { type ContentFix } from "@zoonk/db";
import { logInfo } from "@zoonk/utils/logger";
import { batchOf, getContentFixReviewUrl } from "../batches";
import { contentFixChangesSchema, contentFixEffectsSchema } from "../contract";
import { contentFixVoiceSchema } from "../voice-schema";

export function toContentFixView(fix: ContentFix) {
  return {
    batchId: batchOf(fix),
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
  action: "apply" | "approve" | "propose" | "reject" | "resume" | "revert" | "withdraw";
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
