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
import { startPictureChecks } from "../../images/start-picture-checks";

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

/** Null when sorting failed: field practice is extra, and the next preparation tries again. */
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

  const context = toContentAnalytics({ analytics, scope: skill, workflowRunId });

  const { created, unchecked } = await createItems({
    analytics: context,
    field,
    format: "multipleChoice",
    items: data.items,
    language: skill.language,
    provenance,
    skillId: skill.id,
  });

  await startPictureChecks({ analytics: context, assetIds: unchecked });

  return created.length;
}
