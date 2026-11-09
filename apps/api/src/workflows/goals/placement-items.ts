import { type CallWait } from "@zoonk/ai/provider-options";
import { type ContentAnalytics, toContentAnalytics } from "../_shared/content-analytics";
import { checkItemKeysStep } from "./steps/item-keys-step";
import {
  type CheckedSkillItems,
  DEFAULT_QUICK_COUNT,
  type PlacementBatch,
  type PlacementItemsRequest,
  getQuickOptionCount,
  isGoalInPlacementWeekStep,
  pickPlacementBatchesStep,
  storePlacementBatchStep,
  writePlacementBatchStep,
} from "./steps/placement-items-steps";

export type PlacementItemsWritten = { failed: number; written: number };

function getBatchWait({ index, later }: { index: number; later: boolean }): CallWait {
  if (later) {
    return "later";
  }

  return index === 0 ? "learner" : "soon";
}

function countWritten({
  batches,
  results,
}: {
  batches: readonly unknown[][];
  results: readonly PromiseSettledResult<number>[];
}): PlacementItemsWritten {
  return results.reduce<PlacementItemsWritten>(
    (total, result, index) => {
      const size = batches[index]?.length ?? 0;
      const written = result.status === "fulfilled" ? result.value : 0;

      return { failed: total.failed + size - written, written: total.written + written };
    },
    { failed: 0, written: 0 },
  );
}

/** The batch's key check runs at the batch's own wait, so the first question stays a learner's call. */
async function preparePlacementBatch(batch: PlacementBatch & { wait: CallWait }): Promise<number> {
  const { analytics, quickFormat, skills, wait, workflowRunId } = batch;
  const [first] = skills;
  const written = await writePlacementBatchStep(batch);

  if (!first || !written) {
    return 0;
  }

  const quick = written.items.flatMap((items, skill) =>
    items.quick.map((item) => ({ item, skill })),
  );

  const { kept } = await checkItemKeysStep({
    analytics: toContentAnalytics({ analytics, scope: first, workflowRunId }),
    items: quick.map(({ item }) => item),
    language: first.language,
    optionCount: getQuickOptionCount({ quickFormat, skill: first }),
    optionLanguage: first.targetLanguage,
    wait,
  });

  const items: CheckedSkillItems[] = written.items.map(({ typed }, skill) => ({
    quick: kept.filter(({ index }) => quick[index]?.skill === skill).map(({ item }) => item),
    typed,
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
  const { analytics, later = false, quickCount = DEFAULT_QUICK_COUNT, workflowRunId } = request;
  const { batches, confirmingCount, quickFormat } = await pickPlacementBatchesStep(request);

  const results = await Promise.allSettled(
    batches.map((skills, index) =>
      preparePlacementBatch({
        analytics,
        confirmingCount,
        quickCount,
        quickFormat,
        skills,
        wait: getBatchWait({ index, later }),
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
