import { CliError, usageError } from "./errors.ts";
import { commandUsage } from "./help.ts";
import { parseWholeNumber } from "./query-options.ts";

export const AUDIT_CLIPS_PATH = "/staff/audit-clips";

export function checkAuditPage(body: Record<string, unknown>) {
  if (body.listened === 0 && typeof body.unchecked === "number" && body.unchecked > 0) {
    throw new CliError("No clips could be checked. Inspect uncheckedEntries before continuing.");
  }
}

export function auditClipsCommand(
  [kind]: string[],
  {
    after,
    limit,
    "voiced-before": voicedBefore,
  }: { after?: string; limit?: string; "voiced-before"?: string },
) {
  if (kind !== "words" && kind !== "sentences") {
    throw usageError(`Choose "words" or "sentences": ${commandUsage("staff audit-clips")}`);
  }

  return {
    name: "request",
    request: {
      body: { after, kind, limit: parseWholeNumber("limit", limit), voicedBefore },
      method: "POST",
      path: AUDIT_CLIPS_PATH,
    },
  } as const;
}
