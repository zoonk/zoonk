import { type CallWait } from "@zoonk/ai/provider-options";
import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { findSkillLevelBatchesStep, tagSkillLevelsStep } from "./steps/skill-levels-steps";

type SkillLevelsInput = { analytics?: ContentAnalytics; skillIds: string[]; wait: CallWait };

/** `key` names what the run tags, so starting it again joins the run already doing it. */
export function getSkillLevelsToken(key: string): string {
  return `skill-levels:${key}`;
}

/** Tags the language skills among `skillIds` that have no level yet, one call per batch. */
export async function skillLevelsWorkflow({
  analytics,
  skillIds,
  wait,
}: SkillLevelsInput): Promise<number> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const batches = await findSkillLevelBatchesStep(skillIds);

  const tagged = await Promise.allSettled(
    batches.map((batch) => tagSkillLevelsStep({ analytics, batch, wait, workflowRunId })),
  );

  return tagged.reduce((sum, batch) => sum + (batch.status === "fulfilled" ? batch.value : 0), 0);
}
