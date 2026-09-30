import { start } from "workflow/api";
import { repeatUntil } from "../_shared/repeat-until";
import { freshnessWorkflow } from "../freshness/freshness-workflow";
import { laterReviewWorkflow } from "../quality/later-review-workflow";
import { flaggedContentWorkflow } from "../review-flags/flagged-content-workflow";
import {
  countOpenReviewFlagsStep,
  deleteInactiveGuestsStep,
  listDueFreshnessTargetsStep,
  listLessonsForLaterReviewStep,
  purgeEvaluationRunsStep,
  purgeMemoryFactsStep,
  recalibrateItemDifficultiesStep,
} from "./steps/sweep-steps";

/** Guests are deleted a batch at a time; past this many batches the next day continues. */
const MAX_GUEST_BATCHES = 20;

export type DailySweepsResult = {
  evaluationRunsPurged: number;
  flaggedContentStarted: boolean;
  freshnessChecks: number;
  guestsDeleted: number;
  itemsRecalibrated: number;
  laterReviews: number;
  memoryFactsPurged: number;
};

/** A sweep that failed counts as having done nothing; the next day runs it again. */
function countOf(result: PromiseSettledResult<number>): number {
  return result.status === "fulfilled" ? result.value : 0;
}

/** One check per exam or source due before the next sweep; each check stores when the next is due. */
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

/** Content built on a source that changed since gets rewritten, a bounded batch a day. */
async function rewriteFlaggedContent(): Promise<boolean> {
  const open = await countOpenReviewFlagsStep();

  if (open === 0) {
    return false;
  }

  await start(flaggedContentWorkflow, [{}]);
  return true;
}

/** A sample of the lessons made ahead of time in the last day gets its later check. */
async function startLaterReviews(): Promise<number> {
  const lessonIds = await listLessonsForLaterReviewStep();

  if (lessonIds.length > 0) {
    await start(laterReviewWorkflow, [{ lessonIds }]);
  }

  return lessonIds.length;
}

/**
 * The daily sweeps, each one query wide, started by Vercel Cron: check every exam and source
 * whose freshness check is due, delete guests inactive for 30 days (with everything they
 * created), purge memory facts deleted or expired more than 30 days ago and evaluation runs older
 * than 30 days, recalibrate the difficulty of questions answered that day, start the later check
 * of lessons made ahead of time, and rewrite what was built on a source that changed.
 */
export async function dailySweepsWorkflow(): Promise<DailySweepsResult> {
  "use workflow";

  // Each sweep stands alone: one failing doesn't keep the others from running.
  const [checks, guests, facts, runs, items, reviews, flagged] = await Promise.allSettled([
    checkFreshness(),
    deleteGuests(),
    purgeMemoryFactsStep(),
    purgeEvaluationRunsStep(),
    recalibrateItemDifficultiesStep(),
    startLaterReviews(),
    rewriteFlaggedContent(),
  ]);

  return {
    evaluationRunsPurged: countOf(runs),
    flaggedContentStarted: flagged.status === "fulfilled" && flagged.value,
    freshnessChecks: countOf(checks),
    guestsDeleted: countOf(guests),
    itemsRecalibrated: countOf(items),
    laterReviews: countOf(reviews),
    memoryFactsPurged: countOf(facts),
  };
}
