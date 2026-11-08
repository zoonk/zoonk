import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type SkillLevelBatch,
  findSkillLevelBatches,
  tagSkillLevels,
} from "@zoonk/core/library/skills/tag-levels";
import { type ContentAnalytics } from "../../_shared/content-analytics";

export async function findSkillLevelBatchesStep(skillIds: string[]): Promise<SkillLevelBatch[]> {
  "use step";

  return findSkillLevelBatches(skillIds);
}

export async function tagSkillLevelsStep({
  analytics,
  batch,
  wait,
}: {
  analytics?: ContentAnalytics;
  batch: SkillLevelBatch;
  wait: CallWait;
}): Promise<number> {
  "use step";

  return tagSkillLevels({ analytics, batch, serviceTier: chooseServiceTier({ wait }) });
}
