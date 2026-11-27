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
  isTapWorthStoring,
  pickPlacementItemSkills,
} from "@zoonk/core/lookahead/placement-item-skills";
import { isGoalInPlacementWeek } from "@zoonk/core/lookahead/placement-week";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { startPictureChecks } from "../../images/start-picture-checks";
import { type PlacementSkillWrite, toPlacementItemBatches } from "../placement-item-batches";

const DEFAULT_QUICK_COUNT = 1;

type WriteContext = { analytics?: ContentAnalytics; workflowRunId: string };

type PlacementQuickFormat = PlacementItemPicks["quickFormat"];

type PlacementProvenance = Awaited<ReturnType<typeof generatePlacementItems>>["provenance"];

type PlacementAnalytics = ReturnType<typeof toContentAnalytics>;

export type PlacementSkillBatch = PlacementSkillWrite<PlacementItemPick>[];

/** A multiple-choice tap question is "select all that apply", whose key a blind solve checks. */
export type CheckedSkillItems = {
  quick: KeyCheckedItem[];
  selectAll: KeyCheckedItem[];
  taps: GeneratedItem[];
};

type SkillItems =
  | { format: PlacementQuickFormat; items: KeyCheckedItem[]; select?: "all" }
  | { format: "matchPairs" | "order"; items: GeneratedItem[] };

export function getQuickOptionCount({
  quickFormat,
  skill,
}: {
  quickFormat: PlacementQuickFormat;
  skill: Pick<PlacementItemPick, "exam">;
}): number | null {
  return quickFormat === "multipleChoice" ? (skill.exam?.optionCount ?? null) : null;
}

async function storeSkillItems({
  analytics,
  optionCount,
  provenance,
  skill,
  ...written
}: SkillItems & {
  analytics: PlacementAnalytics;
  optionCount: number | null;
  provenance: PlacementProvenance;
  skill: PlacementItemPick;
}): Promise<number> {
  if (written.items.length === 0) {
    return 0;
  }

  const { created, unchecked } = await createItems({
    ...written,
    analytics,
    examBlueprintId: skill.exam?.blueprintId ?? null,
    language: skill.language,
    optionCount,
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
  const shared = { analytics, provenance, skill };

  const tapsOf = (format: "matchPairs" | "order") =>
    items.taps.filter((item) => item.format === format);

  const stored = await Promise.all([
    storeSkillItems({
      ...shared,
      format: quickFormat,
      items: items.quick,
      optionCount: getQuickOptionCount({ quickFormat, skill }),
    }),
    storeSkillItems({
      ...shared,
      format: "multipleChoice",
      items: items.selectAll,
      optionCount: null,
      select: "all",
    }),
    storeSkillItems({
      ...shared,
      format: "matchPairs",
      items: tapsOf("matchPairs"),
      optionCount: null,
    }),
    storeSkillItems({ ...shared, format: "order", items: tapsOf("order"), optionCount: null }),
  ]);

  return stored.some((count) => count > 0);
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
  batches: PlacementSkillBatch[];
  prioritySkillIds: string[];
  quickFormat: PlacementQuickFormat;
}> {
  "use step";

  const { confirmingCount, prioritySkillIds, quickFormat, skills } = await pickPlacementItemSkills({
    choice,
    exceptAnswered,
    forPlacement,
    formats,
    goalId,
    quickNeeded,
    skillIds,
  });

  return {
    batches: toPlacementItemBatches({ quickCount: quickCount + confirmingCount, skills }),
    prioritySkillIds,
    quickFormat,
  };
}

export type PlacementBatch = WriteContext & {
  quickFormat: PlacementQuickFormat;
  skills: PlacementSkillBatch;
  wait?: CallWait;
};

/** Null for a batch without skills; otherwise each skill's questions in the batch's order. */
export async function writePlacementBatchStep({
  analytics,
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
    country: first.country,
    examFormat: first.exam,
    language: first.language,
    quickFormat,
    serviceTier: chooseServiceTier({ wait }),
    skills: skills.map((skill) => ({
      description: skill.description,
      level: skill.level ?? "beginner",
      name: skill.name,
      quickCount: skill.quickCount,
      tapCount: skill.tapCount,
      usedSituations: skill.usedSituations,
    })),
    targetLanguage: first.targetLanguage,
  });

  const items = data.skills.map(({ quick, taps }) => ({
    quick,
    taps: taps.filter((item) => isTapWorthStoring(item)),
  }));

  return { items, provenance };
}

/** The ids of the skills that got any question stored. */
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
  skills: PlacementSkillBatch;
}): Promise<string[]> {
  "use step";

  const stored = await Promise.allSettled(
    skills.map((skill, index) =>
      storePlacementItems({
        analytics: toContentAnalytics({ analytics, scope: skill, workflowRunId }),
        items: items[index] ?? { quick: [], selectAll: [], taps: [] },
        provenance,
        quickFormat,
        skill,
      }),
    ),
  );

  return skills.flatMap((skill, index) => {
    const result = stored[index];
    return result?.status === "fulfilled" && result.value ? [skill.id] : [];
  });
}

export async function isGoalInPlacementWeekStep(input: {
  goalId: string;
  timeZone: string;
}): Promise<boolean> {
  "use step";

  return isGoalInPlacementWeek(input);
}
