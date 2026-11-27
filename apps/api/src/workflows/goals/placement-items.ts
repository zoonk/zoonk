import { type CallWait } from "@zoonk/ai/provider-options";
import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { type ContentAnalytics, toContentAnalytics } from "../_shared/content-analytics";
import { checkItemKeysStep } from "./steps/item-keys-step";
import {
  type CheckedSkillItems,
  type PlacementBatch,
  type PlacementItemsRequest,
  getQuickOptionCount,
  isGoalInPlacementWeekStep,
  pickPlacementBatchesStep,
  storePlacementBatchStep,
  writePlacementBatchStep,
} from "./steps/placement-items-steps";

export type PlacementItemsWritten = { failed: number; written: number };

/** The first pick's tap questions come right after its quick one, so both are a learner's wait. */
function getBatchWait({
  batch,
  priority,
  later,
}: {
  batch: PlacementBatch["skills"];
  priority: ReadonlySet<string>;
  later: boolean;
}): CallWait {
  if (later) {
    return "later";
  }

  return batch.some((skill) => priority.has(skill.id)) ? "learner" : "soon";
}

/** A skill counts once, though the first pick's quick and tap questions are written apart. */
function countWritten({
  batches,
  results,
}: {
  batches: readonly PlacementBatch["skills"][];
  results: readonly PromiseSettledResult<string[]>[];
}): PlacementItemsWritten {
  const picked = new Set(batches.flat().map((skill) => skill.id));

  const stored = new Set(
    results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
  );

  return { failed: picked.size - stored.size, written: stored.size };
}

type SkillItem = { item: GeneratedItem; skill: number };

/** The batch's key checks run at the batch's own wait, so the first question stays a learner's call. */
async function preparePlacementBatch(
  batch: PlacementBatch & { wait: CallWait },
): Promise<string[]> {
  const { analytics, quickFormat, skills, wait, workflowRunId } = batch;
  const [first] = skills;
  const written = await writePlacementBatchStep(batch);

  if (!first || !written) {
    return [];
  }

  const quick: SkillItem[] = written.items.flatMap((items, skill) =>
    items.quick.map((item) => ({ item, skill })),
  );

  const taps: SkillItem[] = written.items.flatMap((items, skill) =>
    items.taps.map((item) => ({ item, skill })),
  );

  const selectAll = taps.filter(({ item }) => item.format === "multipleChoice");

  const check = { language: first.language, optionLanguage: first.targetLanguage, wait };
  const checkAnalytics = toContentAnalytics({ analytics, scope: first, workflowRunId });

  const checkKeys = (
    entries: SkillItem[],
    answer: { optionCount?: number | null; select?: "all" },
  ) =>
    entries.length === 0
      ? { kept: [] }
      : checkItemKeysStep({
          ...check,
          ...answer,
          analytics: checkAnalytics,
          items: entries.map(({ item }) => item),
        });

  const [quickKept, selectAllKept] = await Promise.all([
    checkKeys(quick, { optionCount: getQuickOptionCount({ quickFormat, skill: first }) }),
    checkKeys(selectAll, { select: "all" }),
  ]);

  const ofSkill = (kept: (typeof quickKept)["kept"], entries: SkillItem[], skill: number) =>
    kept.filter(({ index }) => entries[index]?.skill === skill).map(({ item }) => item);

  const items: CheckedSkillItems[] = written.items.map((_, skill) => ({
    quick: ofSkill(quickKept.kept, quick, skill),
    selectAll: ofSkill(selectAllKept.kept, selectAll, skill),
    taps: taps
      .filter((tap) => tap.skill === skill && tap.item.format !== "multipleChoice")
      .map(({ item }) => item),
  }));

  return storePlacementBatchStep({
    analytics,
    items,
    provenance: written.provenance,
    quickFormat,
    skills,
    workflowRunId,
  });
}

export async function preparePlacementItems(
  request: PlacementItemsRequest,
): Promise<PlacementItemsWritten> {
  const { analytics, later = false, workflowRunId } = request;
  const { batches, prioritySkillIds, quickFormat } = await pickPlacementBatchesStep(request);

  const first = batches[0]?.[0]?.id;
  const priority = new Set(prioritySkillIds);

  if (first) {
    priority.add(first);
  }

  const results = await Promise.allSettled(
    batches.map((skills) =>
      preparePlacementBatch({
        analytics,
        quickFormat,
        skills,
        wait: getBatchWait({ batch: skills, later, priority }),
        workflowRunId,
      }),
    ),
  );

  return countWritten({ batches, results });
}

export async function preparePlacementWeekItems({
  analytics,
  goalId,
  timeZone,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  goalId: string;
  timeZone: string;
  workflowRunId: string;
}): Promise<PlacementItemsWritten> {
  if (!(await isGoalInPlacementWeekStep({ goalId, timeZone }))) {
    return { failed: 0, written: 0 };
  }

  return preparePlacementItems({
    analytics,
    forPlacement: true,
    goalId,
    later: true,
    workflowRunId,
  });
}
