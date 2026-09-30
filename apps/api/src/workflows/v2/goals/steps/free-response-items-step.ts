import { generateItems } from "@zoonk/ai/tasks/v2/items/generate";
import { createItems } from "@zoonk/core/library/items/create";
import { pickFreeResponseSkills } from "@zoonk/core/lookahead/free-response-skills";
import { type PlacementItemSkill } from "@zoonk/core/lookahead/placement-item-skills";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

export async function pickFreeResponseSkillsStep(goalId: string): Promise<PlacementItemSkill[]> {
  "use step";

  return pickFreeResponseSkills({ goalId });
}

/**
 * Writes one original free-response question for an AP skill, with the rubric rows and points its
 * scoring guidelines would give, so the goal's essay block can practice and grade it. It joins the
 * shared bank under the exam, for every learner of that AP exam.
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

  const { created } = await createItems({
    examBlueprintId: exam?.blueprintId ?? null,
    format: "essay",
    items: data.items,
    language: skill.language,
    provenance,
    skillId: skill.id,
  });

  return created.length;
}
