import { generateItems } from "@zoonk/ai/tasks/items/generate";
import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { type KeyCheckedItem } from "@zoonk/core/library/items/check-keys";
import { createItems } from "@zoonk/core/library/items/create";
import {
  FIELD_ITEMS_PER_SKILL,
  type FieldItemTarget,
  listGoalFieldItemTargets,
  listLessonFieldItemTargets,
} from "@zoonk/core/library/items/field-items";
import { resolveGoalField } from "@zoonk/core/library/items/goal-field";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { startPictureChecks } from "../../images/start-picture-checks";
import { checkItemKeysStep } from "./item-keys-step";

type FieldItemsWrite = {
  analytics?: ContentAnalytics;
  target: FieldItemTarget;
  workflowRunId: string;
};

type WrittenItems = Awaited<ReturnType<typeof generateItems>>;

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

  return resolveGoalField({ analytics: { ...analytics, traceId: workflowRunId }, goalId });
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

async function writeFieldItemsStep({
  analytics,
  target,
  workflowRunId,
}: FieldItemsWrite): Promise<{ items: GeneratedItem[]; provenance: WrittenItems["provenance"] }> {
  "use step";

  const { field, skill } = target;

  const { data, provenance } = await generateItems({
    analytics: toContentAnalytics({ analytics, scope: skill, workflowRunId }),
    count: FIELD_ITEMS_PER_SKILL,
    field,
    format: "multipleChoice",
    language: skill.language,
    level: skill.level ?? "beginner",
    skill: { description: skill.description, example: skill.example, name: skill.name },
  });

  return { items: data.items, provenance };
}

async function storeFieldItemsStep({
  analytics,
  items,
  provenance,
  target,
  workflowRunId,
}: FieldItemsWrite & {
  items: KeyCheckedItem[];
  provenance: WrittenItems["provenance"];
}): Promise<number> {
  "use step";

  const { field, skill } = target;
  const context = toContentAnalytics({ analytics, scope: skill, workflowRunId });

  const { created, unchecked } = await createItems({
    analytics: context,
    field,
    format: "multipleChoice",
    items,
    language: skill.language,
    provenance,
    skillId: skill.id,
  });

  await startPictureChecks({ analytics: context, assetIds: unchecked });

  return created.length;
}

export async function prepareSkillFieldItems(input: FieldItemsWrite): Promise<number> {
  const { analytics, target, workflowRunId } = input;
  const written = await writeFieldItemsStep(input);

  const { kept } = await checkItemKeysStep({
    analytics: toContentAnalytics({ analytics, scope: target.skill, workflowRunId }),
    items: written.items,
    language: target.skill.language,
    wait: "soon",
  });

  return storeFieldItemsStep({
    ...input,
    items: kept.map(({ item }) => item),
    provenance: written.provenance,
  });
}
