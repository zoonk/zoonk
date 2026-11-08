import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type PlacementSkillItems,
  generatePlacementItems,
} from "@zoonk/ai/tasks/items/placement-items";
import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { type KeyCheckedItem } from "@zoonk/core/library/items/check-keys";
import { createItems } from "@zoonk/core/library/items/create";
import { type PlacementChoice } from "@zoonk/core/lookahead/item-exam";
import {
  type PlacementItemFormat,
  type PlacementItemPick,
  type PlacementItemPicks,
  pickPlacementItemSkills,
} from "@zoonk/core/lookahead/placement-item-skills";
import { isGoalInPlacementWeek } from "@zoonk/core/lookahead/placement-week";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { startPictureChecks } from "../../images/start-picture-checks";
import { toPlacementItemBatches } from "../placement-item-batches";

const PLACEMENT_ITEMS_PER_SKILL = { quick: 1, typed: 1 } as const;

export const DEFAULT_QUICK_COUNT = PLACEMENT_ITEMS_PER_SKILL.quick;

type WriteContext = { analytics?: ContentAnalytics; workflowRunId: string };

type PlacementQuickFormat = PlacementItemPicks["quickFormat"];

type PlacementProvenance = Awaited<ReturnType<typeof generatePlacementItems>>["provenance"];

type PlacementAnalytics = ReturnType<typeof toContentAnalytics>;

export type CheckedSkillItems = { quick: KeyCheckedItem[]; typed: GeneratedItem[] };

type SkillItems =
  | { format: PlacementQuickFormat; items: KeyCheckedItem[] }
  | { format: Extract<PlacementItemFormat, "typed">; items: GeneratedItem[] };

export function getQuickOptionCount({
  quickFormat,
  skill,
}: {
  quickFormat: PlacementQuickFormat;
  skill: PlacementItemPick;
}): number | null {
  return quickFormat === "multipleChoice" ? (skill.exam?.optionCount ?? null) : null;
}

async function storeSkillItems({
  analytics,
  provenance,
  skill,
  ...written
}: SkillItems & {
  analytics: PlacementAnalytics;
  provenance: PlacementProvenance;
  skill: PlacementItemPick;
}): Promise<number> {
  const { exam } = skill;

  const { created, unchecked } = await createItems({
    ...written,
    analytics,
    examBlueprintId: exam?.blueprintId ?? null,
    language: skill.language,
    optionCount:
      written.format === "typed"
        ? null
        : getQuickOptionCount({ quickFormat: written.format, skill }),
    optionLanguage: skill.targetLanguage,
    provenance,
    skillId: skill.id,
  });

  await startPictureChecks({ analytics, assetIds: unchecked });

  return created.length;
}

async function storePlacementItems({
  analytics,
  items,
  provenance,
  quickFormat,
  skill,
}: {
  analytics: PlacementAnalytics;
  items: CheckedSkillItems;
  provenance: PlacementProvenance;
  quickFormat: PlacementQuickFormat;
  skill: PlacementItemPick;
}): Promise<boolean> {
  const [quick] = await Promise.all([
    storeSkillItems({ analytics, format: quickFormat, items: items.quick, provenance, skill }),
    skill.needsTyped
      ? storeSkillItems({ analytics, format: "typed", items: items.typed, provenance, skill })
      : null,
  ]);

  return quick > 0;
}

export type PlacementItemsRequest = WriteContext & {
  choice?: PlacementChoice;
  exceptAnswered?: boolean;
  forPlacement?: boolean;
  formats?: readonly PlacementItemFormat[];
  goalId: string;
  later?: boolean;
  quickCount?: number;
  quickNeeded?: number;
  skillIds?: string[];
};

export async function pickPlacementBatchesStep({
  choice,
  exceptAnswered,
  forPlacement,
  formats,
  goalId,
  quickCount = DEFAULT_QUICK_COUNT,
  quickNeeded,
  skillIds,
}: PlacementItemsRequest): Promise<{
  batches: PlacementItemPick[][];
  confirmingCount: number;
  quickFormat: PlacementQuickFormat;
}> {
  "use step";

  const { confirmingCount, quickFormat, skills } = await pickPlacementItemSkills({
    choice,
    exceptAnswered,
    forPlacement,
    formats,
    goalId,
    quickNeeded,
    skillIds,
  });

  return { batches: toPlacementItemBatches({ quickCount, skills }), confirmingCount, quickFormat };
}

export type PlacementBatch = WriteContext & {
  confirmingCount?: number;
  quickCount: number;
  quickFormat: PlacementQuickFormat;
  skills: PlacementItemPick[];
  wait?: CallWait;
};

/** Null for a batch without skills; otherwise each skill's questions in the batch's order. */
export async function writePlacementBatchStep({
  analytics,
  confirmingCount = 0,
  quickCount,
  quickFormat,
  skills,
  wait = "soon",
  workflowRunId,
}: PlacementBatch): Promise<{
  items: PlacementSkillItems[];
  provenance: PlacementProvenance;
} | null> {
  "use step";

  const [first] = skills;

  if (!first) {
    return null;
  }

  const { data, provenance } = await generatePlacementItems({
    analytics: toContentAnalytics({ analytics, scope: first, workflowRunId }),
    examFormat: first.exam,
    language: first.language,
    quickCount: quickCount + confirmingCount,
    quickFormat,
    serviceTier: chooseServiceTier({ wait }),
    skills: skills.map((skill) => ({
      description: skill.description,
      level: skill.level ?? "beginner",
      name: skill.name,
      usedSituations: skill.usedSituations,
    })),
    targetLanguage: first.targetLanguage,
    typedCount: first.needsTyped ? PLACEMENT_ITEMS_PER_SKILL.typed : 0,
  });

  return { items: data.skills, provenance };
}

/** Counts the skills that got a quick question stored. */
export async function storePlacementBatchStep({
  analytics,
  items,
  provenance,
  quickFormat,
  skills,
  workflowRunId,
}: WriteContext & {
  items: CheckedSkillItems[];
  provenance: PlacementProvenance;
  quickFormat: PlacementQuickFormat;
  skills: PlacementItemPick[];
}): Promise<number> {
  "use step";

  const stored = await Promise.allSettled(
    skills.map((skill, index) =>
      storePlacementItems({
        analytics: toContentAnalytics({ analytics, scope: skill, workflowRunId }),
        items: items[index] ?? { quick: [], typed: [] },
        provenance,
        quickFormat,
        skill,
      }),
    ),
  );

  return stored.filter((result) => result.status === "fulfilled" && result.value).length;
}

export async function isGoalInPlacementWeekStep(input: {
  goalId: string;
  timeZone: string;
}): Promise<boolean> {
  "use step";

  return isGoalInPlacementWeek(input);
}
