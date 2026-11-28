import { usageError } from "./errors.ts";
import { commandUsage } from "./help.ts";
import { parseWholeNumber } from "./query-options.ts";

export function auditClipsCommand(
  [kind]: string[],
  {
    after,
    limit,
    "voiced-before": voicedBefore,
  }: { after?: string; limit?: string; "voiced-before"?: string },
) {
  if (kind !== "words" && kind !== "sentences" && kind !== "speech") {
    throw usageError(
      `Choose "words", "sentences", or "speech": ${commandUsage("staff audit-clips")}`,
    );
  }

  return {
    name: "request",
    request: {
      body: { after, kind, limit: parseWholeNumber("limit", limit), voicedBefore },
      method: "POST",
      path: "/staff/audit-clips",
    },
  } as const;
}
