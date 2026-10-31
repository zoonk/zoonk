import { start } from "workflow/api";
import { repeatUntil } from "../_shared/repeat-until";
import { followUpsWorkflow } from "../follow-ups/follow-ups-workflow";
import { listLearnersWithOldFollowUpsStep } from "../follow-ups/steps/follow-up-steps";
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
  purgeExpiredAuthRecordsStep,
  purgeExpiredVerificationsStep,
  purgeMemoryFactsStep,
  recalibrateItemDifficultiesStep,
} from "./steps/sweep-steps";

const MAX_GUEST_BATCHES = 20;

export type DailySweepsResult = {
  accessRecordsPurged: number;
  sessionsPurged: number;
  evaluationRunsPurged: number;
  flaggedContentStarted: boolean;
  followUpsStarted: number;
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

/** Owed work whose start failed, such as an API that didn't answer the learner's request. */
async function startOldFollowUps(): Promise<number> {
  const userIds = await listLearnersWithOldFollowUpsStep();
  await Promise.all(userIds.map((userId) => start(followUpsWorkflow, [{ userId }])));

  return userIds.length;
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

  const [
    checks,
    guests,
    facts,
    runs,
    items,
    reviews,
    flagged,
    retired,
    verifications,
    access,
    followUps,
  ] = await Promise.allSettled([
    checkFreshness(),
    deleteGuests(),
    purgeMemoryFactsStep(),
    purgeEvaluationRunsStep(),
    recalibrateItemDifficultiesStep(),
    startLaterReviews(),
    rewriteFlaggedContent(),
    deleteRetiredStepsStep(),
    purgeExpiredVerificationsStep(),
    purgeExpiredAuthRecordsStep(),
    startOldFollowUps(),
  ]);

  return {
    accessRecordsPurged: access.status === "fulfilled" ? access.value.recordsPurged : 0,
    evaluationRunsPurged: countOf(runs),
    flaggedContentStarted: flagged.status === "fulfilled" && flagged.value,
    followUpsStarted: countOf(followUps),
    freshnessChecks: countOf(checks),
    guestsDeleted: countOf(guests),
    itemsRecalibrated: countOf(items),
    laterReviews: countOf(reviews),
    memoryFactsPurged: countOf(facts),
    retiredStepsDeleted: countOf(retired),
    sessionsPurged: access.status === "fulfilled" ? access.value.sessionsPurged : 0,
    verificationsPurged: countOf(verifications),
  };
}
