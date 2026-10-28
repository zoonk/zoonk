import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type PlacementSkillItems,
  generatePlacementItems,
} from "@zoonk/ai/tasks/v2/items/placement-items";
import { getContentReuse } from "@zoonk/core/library/curriculum/scope";
import { createItems } from "@zoonk/core/library/items/create";
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

async function storeSkillItems({
  analytics,
  format,
  items,
  provenance,
  skill,
}: {
  analytics: PlacementAnalytics;
  format: PlacementItemFormat;
  items: PlacementSkillItems["quick"];
  provenance: PlacementProvenance;
  skill: PlacementItemPick;
}): Promise<number> {
  const { exam } = skill;

  const { created, unchecked } = await createItems({
    analytics,
    examBlueprintId: exam?.blueprintId ?? null,
    format,
    items,
    language: skill.language,
    optionCount: format === "multipleChoice" ? (exam?.optionCount ?? null) : null,
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
  items: PlacementSkillItems;
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
    exceptAnswered,
    forPlacement,
    formats,
    goalId,
    quickNeeded,
    skillIds,
  });

  return { batches: toPlacementItemBatches({ quickCount, skills }), confirmingCount, quickFormat };
}

export async function writePlacementBatchStep({
  analytics,
  confirmingCount = 0,
  quickCount,
  quickFormat,
  skills,
  wait = "soon",
  workflowRunId,
}: WriteContext & {
  confirmingCount?: number;
  quickCount: number;
  quickFormat: PlacementQuickFormat;
  skills: PlacementItemPick[];
  wait?: CallWait;
}): Promise<number> {
  "use step";

  const [first] = skills;

  if (!first) {
    return 0;
  }

  const serviceTier = chooseServiceTier({
    reuse: getContentReuse({
      forExam: first.exam !== null,
      ownerId: first.ownerId,
      targetLanguage: first.targetLanguage,
    }),
    wait,
  });

  const { data, provenance } = await generatePlacementItems({
    analytics: toContentAnalytics({ analytics, scope: first, workflowRunId }),
    examFormat: first.exam,
    language: first.language,
    quickCount: quickCount + confirmingCount,
    quickFormat,
    serviceTier,
    skills: skills.map((skill) => ({
      description: skill.description,
      level: skill.level ?? "beginner",
      name: skill.name,
      usedSituations: skill.usedSituations,
    })),
    targetLanguage: first.targetLanguage,
    typedCount: first.needsTyped ? PLACEMENT_ITEMS_PER_SKILL.typed : 0,
  });

  const stored = await Promise.allSettled(
    skills.map((skill, index) =>
      storePlacementItems({
        analytics: toContentAnalytics({ analytics, scope: skill, workflowRunId }),
        items: data.skills[index] ?? { quick: [], typed: [] },
        provenance,
        quickFormat,
        skill,
      }),
    ),
  );

  return stored.filter((result) => result.status === "fulfilled" && result.value).length;
}

writePlacementBatchStep.maxRetries = 1;

export async function isGoalInPlacementWeekStep(input: {
  goalId: string;
  timeZone: string;
}): Promise<boolean> {
  "use step";

  return isGoalInPlacementWeek(input);
}
