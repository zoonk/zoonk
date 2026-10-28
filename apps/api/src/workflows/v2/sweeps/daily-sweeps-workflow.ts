import { start } from "workflow/api";
import { repeatUntil } from "../_shared/repeat-until";
import { freshnessWorkflow } from "../freshness/freshness-workflow";
import { laterReviewWorkflow } from "../quality/later-review-workflow";
import { flaggedContentWorkflow } from "../review-flags/flagged-content-workflow";
import {
  countOpenReviewFlagsStep,
  deleteInactiveGuestsStep,
  deleteRetiredStepsStep,
  listDueFreshnessTargetsStep,
  listLessonsForLaterReviewStep,
  purgeEvaluationRunsStep,
  purgeExpiredVerificationsStep,
  purgeMemoryFactsStep,
  recalibrateItemDifficultiesStep,
} from "./steps/sweep-steps";

const MAX_GUEST_BATCHES = 20;

export type DailySweepsResult = {
  evaluationRunsPurged: number;
  flaggedContentStarted: boolean;
  freshnessChecks: number;
  guestsDeleted: number;
  itemsRecalibrated: number;
  laterReviews: number;
  memoryFactsPurged: number;
  retiredStepsDeleted: number;
  verificationsPurged: number;
};

function countOf(result: PromiseSettledResult<number>): number {
  return result.status === "fulfilled" ? result.value : 0;
}

async function checkFreshness(): Promise<number> {
  const targets = await listDueFreshnessTargetsStep();
  await Promise.all(targets.map((target) => start(freshnessWorkflow, [target])));

  return targets.length;
}

async function deleteGuests(): Promise<number> {
  const { total } = await repeatUntil<{ deleted: number; total: number }>({
    done: ({ deleted }) => deleted === 0,
    run: async (previous) => {
      const deleted = await deleteInactiveGuestsStep();
      return { deleted, total: (previous?.total ?? 0) + deleted };
    },
    times: MAX_GUEST_BATCHES,
  });

  return total;
}

async function rewriteFlaggedContent(): Promise<boolean> {
  const open = await countOpenReviewFlagsStep();

  if (open === 0) {
    return false;
  }

  await start(flaggedContentWorkflow, [{}]);
  return true;
}

async function startLaterReviews(): Promise<number> {
  const lessonIds = await listLessonsForLaterReviewStep();

  if (lessonIds.length > 0) {
    await start(laterReviewWorkflow, [{ lessonIds }]);
  }

  return lessonIds.length;
}

export async function dailySweepsWorkflow(): Promise<DailySweepsResult> {
  "use workflow";

  const [checks, guests, facts, runs, items, reviews, flagged, retired, verifications] =
    await Promise.allSettled([
      checkFreshness(),
      deleteGuests(),
      purgeMemoryFactsStep(),
      purgeEvaluationRunsStep(),
      recalibrateItemDifficultiesStep(),
      startLaterReviews(),
      rewriteFlaggedContent(),
      deleteRetiredStepsStep(),
      purgeExpiredVerificationsStep(),
    ]);

  return {
    evaluationRunsPurged: countOf(runs),
    flaggedContentStarted: flagged.status === "fulfilled" && flagged.value,
    freshnessChecks: countOf(checks),
    guestsDeleted: countOf(guests),
    itemsRecalibrated: countOf(items),
    laterReviews: countOf(reviews),
    memoryFactsPurged: countOf(facts),
    retiredStepsDeleted: countOf(retired),
    verificationsPurged: countOf(verifications),
  };
}
