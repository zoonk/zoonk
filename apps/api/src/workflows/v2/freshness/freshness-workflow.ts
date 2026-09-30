import {
  type FreshnessCheck,
  type FreshnessStopReason,
  type FreshnessTarget,
} from "@zoonk/core/library/exams/check-freshness";
import { getWorkflowMetadata } from "workflow";
import { type ResearchAnalytics, toResearchAnalytics } from "../research/_utils/research-analytics";
import { readExamBlueprint } from "../research/read-exam-blueprint";
import { checkFreshnessStep } from "./steps/check-freshness-step";
import { loadBlueprintIdentityStep } from "./steps/load-blueprint-identity-step";
import { recordSourceNoticeStep } from "./steps/record-source-notice-step";

export type FreshnessRunResult =
  | { reason: FreshnessStopReason; status: "stopped" }
  | { nextCheckAt: string; status: "checked" };

type ScheduledCheck = Extract<FreshnessCheck, { status: "scheduled" }>;

/**
 * Runs a model only when the check found something: the notice is newer than
 * the blueprint (read it and update only what changed, with a notice for
 * learners), or a law or product page changed (write the notice).
 */
async function applyChanges({
  analytics,
  check,
}: {
  analytics: ResearchAnalytics;
  check: ScheduledCheck;
}): Promise<void> {
  if (check.blueprintUpdate) {
    const identity = await loadBlueprintIdentityStep(check.blueprintUpdate.examBlueprintId);

    if (identity) {
      await readExamBlueprint({
        analytics,
        identity,
        isNew: false,
        priority: false,
        sourceIds: [check.blueprintUpdate.sourceId],
      });
    }
  }

  if (check.sourceChange) {
    await recordSourceNoticeStep({ analytics, change: check.sourceChange });
  }
}

/**
 * One freshness check of an exam or source: a fetch and a hash compare, which also stores when
 * the next check is due (daily while registration is open and in the last 14 days, weekly
 * otherwise, and at "valid until" for laws and software), or stops the checks when the exam has
 * passed or nobody studies it. The daily sweep starts it for every check that is due, and admin
 * starts it for "Check now".
 */
export async function freshnessWorkflow(target: FreshnessTarget): Promise<FreshnessRunResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const check = await checkFreshnessStep(target);

  if (check.status === "stopped") {
    return { reason: check.reason, status: "stopped" };
  }

  await applyChanges({
    analytics: toResearchAnalytics({ goal: null, runId: workflowRunId }),
    check,
  });

  return { nextCheckAt: check.nextCheckAt, status: "checked" };
}
