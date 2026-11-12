import { type ContentFix } from "@zoonk/db";
import { logInfo } from "@zoonk/utils/logger";
import { ADMIN_URL } from "@zoonk/utils/url";
import { contentFixChangesSchema, contentFixEffectsSchema } from "../contract";

function getContentFixReviewUrl(fixId: string): string {
  return new URL(`/content-fixes/${fixId}`, ADMIN_URL).toString();
}

export function toContentFixView(fix: ContentFix) {
  return {
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
  };
}

export type ContentFixView = ReturnType<typeof toContentFixView>;

/** One line per proposal or decision: who, which fix and what happened, never the content itself. */
export function logContentFix(entry: {
  action: "approve" | "propose" | "reject" | "revert";
  actorUserId: string | null;
  clientId?: string | null;
  fixId?: string | null;
  outcome: string;
  started: number;
}) {
  logInfo(
    JSON.stringify({
      action: entry.action,
      actorUserId: entry.actorUserId,
      clientId: entry.clientId ?? null,
      durationMs: Math.round(performance.now() - entry.started),
      event: "staff.contentFix",
      fixId: entry.fixId ?? null,
      outcome: entry.outcome,
    }),
  );
}
