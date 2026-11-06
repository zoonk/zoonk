import { startOnce } from "@/workflows/_shared/run-token";
import { freshnessWorkflow } from "@/workflows/freshness/freshness-workflow";
import { readNoticeAgainWorkflow } from "@/workflows/freshness/read-notice-again-workflow";
import { type FreshnessTarget } from "@zoonk/core/library/exams/check-freshness";

function getFreshnessToken(target: FreshnessTarget): string {
  return target.kind === "exam"
    ? `freshness:exam:${target.examBlueprintId}`
    : `freshness:source:${target.sourceId}`;
}

export function startFreshnessCheck(target: FreshnessTarget): Promise<string> {
  return startOnce(freshnessWorkflow, [target], getFreshnessToken(target));
}

export function startNoticeReadingAgain(examBlueprintId: string): Promise<string> {
  return startOnce(
    readNoticeAgainWorkflow,
    [{ examBlueprintId }],
    `read-notice-again:${examBlueprintId}`,
  );
}
