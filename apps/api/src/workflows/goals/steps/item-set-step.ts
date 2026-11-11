import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { writeItemSet } from "@zoonk/ai/tasks/items/write-set";
import { type ItemSetToStore, type WrittenSetItem } from "@zoonk/core/library/items/create-set";
import { prepareWrittenItemSet } from "@zoonk/core/library/items/prepare-set";
import { type ItemSetTarget, pickItemSetTargets } from "@zoonk/core/lookahead/item-set-targets";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { storeKeyCheckedItemSet } from "../../_shared/item-set-steps";

/** Questions on one stimulus: enough to need reading it well, few enough for one sitting. */
const QUESTIONS_PER_SET = { multipleChoice: 3, trueFalse: 4 } as const;

type ItemSetWrite = { analytics?: ContentAnalytics; target: ItemSetTarget; workflowRunId: string };

export async function pickItemSetTargetsStep(goalId: string): Promise<ItemSetTarget[]> {
  "use step";

  return pickItemSetTargets({ goalId });
}

async function writeItemSetStep({
  analytics,
  first,
  target,
}: {
  analytics: AiGenerationContext;
  first: ItemSetTarget["skills"][number];
  target: ItemSetTarget;
}): Promise<ItemSetToStore<WrittenSetItem> | null> {
  "use step";

  const { format, skills, usedTitles } = target;

  const { data, provenance } = await writeItemSet({
    analytics,
    examFormat: first.exam,
    format,
    language: first.language,
    questionCount: QUESTIONS_PER_SET[format],
    serviceTier: chooseServiceTier({ wait: "later" }),
    skills: skills.map((skill) => ({
      description: skill.description,
      level: skill.level ?? "intermediate",
      name: skill.name,
      usedSituations: skill.usedSituations,
    })),
    targetLanguage: first.targetLanguage,
    usedTitles,
  });

  return prepareWrittenItemSet({
    examBlueprintId: first.exam?.blueprintId ?? null,
    format,
    language: first.language,
    optionCount: format === "multipleChoice" ? (first.exam?.optionCount ?? null) : null,
    optionLanguage: first.targetLanguage,
    provenance,
    skillIds: skills.map((skill) => skill.id),
    written: data,
  });
}

export async function prepareItemSet({
  analytics,
  target,
  workflowRunId,
}: ItemSetWrite): Promise<boolean> {
  const [first] = target.skills;

  if (!first) {
    return false;
  }

  const context = toContentAnalytics({ analytics, scope: first, workflowRunId });
  const set = await writeItemSetStep({ analytics: context, first, target });
  const setId = await storeKeyCheckedItemSet({ analytics: context, set, wait: "later" });

  return setId !== null;
}
