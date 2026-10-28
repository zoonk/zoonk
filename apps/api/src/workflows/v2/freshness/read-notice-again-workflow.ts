import { getWorkflowMetadata } from "workflow";
import { toResearchAnalytics } from "../research/_utils/research-analytics";
import { readExamBlueprint } from "../research/read-exam-blueprint";
import { addMissingExamSkillsStep } from "./steps/add-missing-exam-skills-step";
import { loadBlueprintNoticeStep } from "./steps/load-blueprint-notice-step";

/** The only way a reading is redone: a prompt or code change never reads one again on its own. */
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
