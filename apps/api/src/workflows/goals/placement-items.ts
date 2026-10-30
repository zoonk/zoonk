import { type CallWait } from "@zoonk/ai/provider-options";
import { type ContentAnalytics } from "../_shared/content-analytics";
import {
  DEFAULT_QUICK_COUNT,
  type PlacementItemsRequest,
  isGoalInPlacementWeekStep,
  pickPlacementBatchesStep,
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

export async function preparePlacementItems(
  request: PlacementItemsRequest,
): Promise<PlacementItemsWritten> {
  const { analytics, later = false, quickCount = DEFAULT_QUICK_COUNT, workflowRunId } = request;
  const { batches, confirmingCount, quickFormat } = await pickPlacementBatchesStep(request);

  const results = await Promise.allSettled(
    batches.map((skills, index) =>
      writePlacementBatchStep({
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
