import { getWorkflowMetadata } from "workflow";
import { toResearchAnalytics } from "../research/_utils/research-analytics";
import { readExamBlueprint } from "../research/read-exam-blueprint";
import { addMissingExamSkillsStep } from "./steps/add-missing-exam-skills-step";
import { loadBlueprintNoticeStep } from "./steps/load-blueprint-notice-step";

/**
 * Reads an exam's stored notice again because an admin asked, the only way a reading is redone: a
 * prompt or code change never reads one again on its own. It reads with today's instructions at
 * the flex tier, nobody waits on it, and keeps what changed like any reading (`readExamBlueprint`),
 * with a notice for learners and their dates proposed when the exam's days moved. The exam's
 * shared skill graph then gets skills for the topics the reading names that none of its skills
 * teaches, such as a choice's options read for the first time.
 */
export async function readNoticeAgainWorkflow({
  examBlueprintId,
}: {
  examBlueprintId: string;
}): Promise<{ status: "notFound" | "read" }> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const notice = await loadBlueprintNoticeStep(examBlueprintId);

  if (!notice) {
    return { status: "notFound" };
  }

  await readExamBlueprint({
    analytics: toResearchAnalytics({ goal: null, runId: workflowRunId }),
    background: true,
    force: true,
    identity: notice.identity,
    isNew: false,
    sourceIds: [notice.sourceId],
  });

  await addMissingExamSkillsStep(examBlueprintId);

  return { status: "read" };
}
