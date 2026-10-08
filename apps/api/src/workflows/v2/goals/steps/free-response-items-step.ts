import { generateItems } from "@zoonk/ai/tasks/v2/items/generate";
import { createItems } from "@zoonk/core/library/items/create";
import { pickFreeResponseSkills } from "@zoonk/core/lookahead/free-response-skills";
import { type PlacementItemSkill } from "@zoonk/core/lookahead/placement-item-skills";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { startPictureChecks } from "../../images/start-picture-checks";

export async function pickFreeResponseSkillsStep(goalId: string): Promise<PlacementItemSkill[]> {
  "use step";

  return pickFreeResponseSkills({ goalId });
}

/**
 * Writes one original written question for a skill the exam asks in writing (an AP free-response
 * question with the rows and points its scoring guidelines would give, a discursive answer or a
 * peça técnica as the notice sets them), so the goal's essay block can practice and grade it. It
 * joins the shared bank under the exam, for every learner of that exam.
 */
export async function prepareFreeResponseItemStep({
  analytics,
  skill,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  skill: PlacementItemSkill;
  workflowRunId: string;
}): Promise<number> {
  "use step";

  const { exam } = skill;

  const { data, provenance } = await withAiRetry(() =>
    generateItems({
      analytics: toContentAnalytics({ analytics, scope: skill, workflowRunId }),
      count: 1,
      examFormat: exam,
      format: "essay",
      language: skill.language,
      level: skill.level ?? "intermediate",
      skill: { description: skill.description, name: skill.name },
    }),
  );

  const context = toContentAnalytics({ analytics, scope: skill, workflowRunId });

  const { created, unchecked } = await createItems({
    analytics: context,
    examBlueprintId: exam?.blueprintId ?? null,
    format: "essay",
    items: data.items,
    language: skill.language,
    provenance,
    skillId: skill.id,
  });

  await startPictureChecks({ analytics: context, assetIds: unchecked });

  return created.length;
}
