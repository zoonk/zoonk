import { generateItems } from "@zoonk/ai/tasks/v2/items/generate";
import { createItems } from "@zoonk/core/library/items/create";
import {
  FIELD_ITEMS_PER_SKILL,
  type FieldItemTarget,
  listGoalFieldItemTargets,
  listLessonFieldItemTargets,
} from "@zoonk/core/library/items/field-items";
import { resolveGoalField } from "@zoonk/core/library/items/goal-field";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

/**
 * The shareable field a work or career-change goal's practice is set in, sorted from the
 * learner's role answers once and kept on the goal. Null for other goals.
 */
async function resolveGoalFieldStep({
  analytics,
  goalId,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  goalId: string;
  workflowRunId: string;
}): Promise<string | null> {
  "use step";

  return withAiRetry(() =>
    resolveGoalField({ analytics: { ...analytics, traceId: workflowRunId }, goalId }),
  );
}

/**
 * The goal's field, or null when sorting it failed this time: field practice is extra, so a
 * failure never fails the run, and the next preparation tries again.
 */
export async function readGoalField(input: {
  analytics?: ContentAnalytics;
  goalId: string;
  workflowRunId: string;
}): Promise<string | null> {
  const [resolved] = await Promise.allSettled([resolveGoalFieldStep(input)]);
  return resolved.status === "fulfilled" ? resolved.value : null;
}

export async function listGoalFieldItemTargetsStep(input: {
  field: string;
  goalId: string;
}): Promise<FieldItemTarget[]> {
  "use step";

  return listGoalFieldItemTargets(input);
}

export async function listLessonFieldItemTargetsStep(input: {
  field: string;
  lessonIds: string[];
}): Promise<FieldItemTarget[]> {
  "use step";

  return listLessonFieldItemTargets(input);
}

/**
 * Writes a few multiple-choice questions for one skill set in a field's everyday work ("nursing"):
 * the skill is the same, only the situations change. They join the shared item bank under the
 * field, so every learner in that field gets them in practice and reviews, before general ones.
 */
export async function prepareFieldItemsStep({
  analytics,
  target,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  target: FieldItemTarget;
  workflowRunId: string;
}): Promise<number> {
  "use step";

  const { field, skill } = target;

  const { data, provenance } = await withAiRetry(() =>
    generateItems({
      analytics: toContentAnalytics({ analytics, scope: skill, workflowRunId }),
      count: FIELD_ITEMS_PER_SKILL,
      field,
      format: "multipleChoice",
      language: skill.language,
      level: skill.level ?? "beginner",
      skill: { description: skill.description, example: skill.example, name: skill.name },
    }),
  );

  const { created } = await createItems({
    field,
    format: "multipleChoice",
    items: data.items,
    language: skill.language,
    provenance,
    skillId: skill.id,
  });

  return created.length;
}
