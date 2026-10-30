import {
  type FreshnessCheck,
  type FreshnessStopReason,
  type FreshnessTarget,
} from "@zoonk/core/library/exams/check-freshness";
import { getWorkflowMetadata } from "workflow";
import { type ResearchAnalytics, toResearchAnalytics } from "../research/_utils/research-analytics";
import { readExamBlueprint } from "../research/read-exam-blueprint";
import { findAndStoreSources } from "../research/research-sources";
import { checkFreshnessStep } from "./steps/check-freshness-step";
import { loadBlueprintIdentityStep } from "./steps/load-blueprint-identity-step";
import { planNextNoticeStep } from "./steps/plan-next-notice-step";
import { recordSourceNoticeStep } from "./steps/record-source-notice-step";

export type FreshnessRunResult =
  | { reason: FreshnessStopReason; status: "stopped" }
  | { nextCheckAt: string; status: "checked" };

type ScheduledCheck = Extract<FreshnessCheck, { status: "scheduled" }>;

async function searchNextNotice({
  analytics,
  examBlueprintId,
}: {
  analytics: ResearchAnalytics;
  examBlueprintId: string;
}): Promise<void> {
  const identity = await loadBlueprintIdentityStep(examBlueprintId);

  if (!identity) {
    return;
  }

  const plan = await planNextNoticeStep({ analytics, identity });

  const sourceIds = await findAndStoreSources({
    analytics,
    plan,
    requireOfficial: true,
    topic: "exam",
  });

  await readExamBlueprint({ analytics, background: true, identity, isNew: false, sourceIds });
}

async function applyChanges({
  analytics,
  check,
}: {
  analytics: ResearchAnalytics;
  check: ScheduledCheck;
}): Promise<void> {
  if (check.nextNotice) {
    await searchNextNotice({ analytics, examBlueprintId: check.nextNotice.examBlueprintId });
  }

  if (check.blueprintUpdate) {
    const identity = await loadBlueprintIdentityStep(check.blueprintUpdate.examBlueprintId);

    if (identity) {
      await readExamBlueprint({
        analytics,
        background: true,
        identity,
        isNew: false,
        sourceIds: [check.blueprintUpdate.sourceId],
      });
    }
  }

  if (check.sourceChange) {
    await recordSourceNoticeStep({ analytics, change: check.sourceChange });
  }
}

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
