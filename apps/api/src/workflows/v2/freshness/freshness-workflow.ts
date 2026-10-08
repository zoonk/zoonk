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

/**
 * After the stored edition's exam, the next notice is searched for on the board's official
 * domains; a notice found that the blueprint wasn't read from is read (see `readExamBlueprint`),
 * and the goals whose date isn't its new exam day get that day as a change to apply.
 */
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

/**
 * Runs a model only when the check found something: the notice is newer than
 * the blueprint (read it and update only what changed, with a notice for
 * learners), a law or product page changed (write the notice), or the stored
 * edition passed while learners prepare for the next (search for its notice).
 */
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

/**
 * One freshness check of an exam or source: a fetch and a hash compare, which also stores when
 * the next check is due (daily while registration is open and in the last 14 days, weekly
 * otherwise, and at "valid until" for laws and software), or stops the checks when nobody studies
 * it. Once the stored edition's exam has passed, learners preparing for the next edition get a
 * weekly search for its notice instead, so "we'll tell you when the notice is out" holds. The daily sweep starts it for every check that is due, and admin
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
