import { chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type FreshnessCheck,
  type FreshnessStopReason,
  type FreshnessTarget,
} from "@zoonk/core/library/exams/check-freshness";
import { getWorkflowMetadata } from "workflow";
import { claimRunToken, startOnce } from "../_shared/run-token";
import { courseReleaseWorkflow, getCourseReleaseToken } from "../products/course-release-workflow";
import { type ResearchAnalytics, toResearchAnalytics } from "../research/_utils/research-analytics";
import { readExamBlueprint } from "../research/read-exam-blueprint";
import { findAndStoreSources } from "../research/research-sources";
import { checkFreshnessStep } from "./steps/check-freshness-step";
import { loadBlueprintIdentityStep } from "./steps/load-blueprint-identity-step";
import { loadBlueprintNoticeStep } from "./steps/load-blueprint-notice-step";
import { planNextNoticeStep } from "./steps/plan-next-notice-step";
import { readProductReleasesStep, saveProductReleasesStep } from "./steps/product-releases-steps";
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

  const { board, notDownloaded, sourceIds } = await findAndStoreSources({
    analytics,
    plan,
    requireOfficial: true,
    serviceTier: chooseServiceTier({ wait: "later" }),
    topic: "exam",
  });

  await readExamBlueprint({
    analytics,
    background: true,
    board,
    identity,
    isNew: false,
    notDownloaded,
    sourceIds,
  });
}

/**
 * One reading per product at a time, shared with research's refresh of a stale product. The main
 * courses a new current release leaves behind start their update.
 */
async function readProductReleases({
  analytics,
  productId,
}: {
  analytics: ResearchAnalytics;
  productId: string;
}): Promise<void> {
  using claim = await claimRunToken(`product:${productId}`);

  if (claim.conflict) {
    return;
  }

  const reading = await readProductReleasesStep({ analytics, productId });

  if (!reading) {
    return;
  }

  const courseIds = await saveProductReleasesStep(reading);

  await Promise.all(
    courseIds.map((courseId) =>
      startOnce(courseReleaseWorkflow, [{ courseId }], getCourseReleaseToken(courseId)),
    ),
  );
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
    const notice = await loadBlueprintNoticeStep(check.blueprintUpdate.examBlueprintId);

    if (notice) {
      await readExamBlueprint({
        analytics,
        background: true,
        identity: notice.identity,
        isNew: false,
        sourceIds: notice.sourceIds,
      });
    }
  }

  if (check.sourceChange) {
    await recordSourceNoticeStep({ analytics, change: check.sourceChange });
  }

  if (check.releasesUpdate) {
    await readProductReleases({ analytics, productId: check.releasesUpdate.productId });
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
