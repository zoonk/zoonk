import { type CallWait } from "@zoonk/ai/provider-options";
import { type ContentAnalytics } from "../_shared/content-analytics";
import {
  DEFAULT_QUICK_COUNT,
  type PlacementItemsRequest,
  isGoalInPlacementWeekStep,
  pickPlacementBatchesStep,
  writePlacementBatchStep,
} from "./steps/placement-items-steps";

/** Skills placement can ask now that their questions are stored, and skills that got nothing. */
export type PlacementItemsWritten = { failed: number; written: number };

function getBatchWait({ index, later }: { index: number; later: boolean }): CallWait {
  if (later) {
    return "later";
  }

  return index === 0 ? "learner" : "soon";
}

/** A batch counts its skills placement can ask; one whose step failed for good counts every skill as failed. */
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

/**
 * Writes placement's questions for the skills the run picked from the skill graph once they're in
 * the Library (`skillIds`), or for the plan's picks when the plan came with the goal (or its exam's
 * blueprint came after its first questions): a quick question in the goal's quick format and a
 * typed one for each skill that has none placement can ask, a few skills per model call, each call
 * a step of its own, all at once, so one failing never holds up the others and the runtime retries
 * it alone (`writePlacementBatchStep`). Each call's questions are stored as soon as it's done, so
 * placement can ask them while the others are written. What still fails is counted, not thrown:
 * placement stops waiting for it. A chapter's test-out asks a few multiple-choice questions only,
 * so it passes that format (`formats`) and how many (`quickCount`).
 */
export async function preparePlacementItems(
  request: PlacementItemsRequest,
): Promise<PlacementItemsWritten> {
  const { analytics, later = false, quickCount = DEFAULT_QUICK_COUNT, workflowRunId } = request;
  const { batches, quickFormat } = await pickPlacementBatchesStep(request);

  const results = await Promise.allSettled(
    batches.map((skills, index) =>
      writePlacementBatchStep({
        analytics,
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

/**
 * During placement's first week (`isGoalInPlacementWeek`), the questions of the plan's picks that
 * have none, for the next days' sessions to ask: a subject the plan gained after day 1's placement
 * (the notice's English and IT, applied after Rafaela's placement) is placed too. Picks with their
 * questions are skipped, so most preparations write nothing.
 */
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
