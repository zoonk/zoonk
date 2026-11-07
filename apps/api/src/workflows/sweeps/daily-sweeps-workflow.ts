import { startFreshnessCheck } from "@/lib/freshness";
import { createHook } from "workflow";
import { start } from "workflow/api";
import { repeatUntil } from "../_shared/repeat-until";
import { startOnce } from "../_shared/run-token";
import { followUpsWorkflow, getFollowUpsToken } from "../follow-ups/follow-ups-workflow";
import { listLearnersWithOldFollowUpsStep } from "../follow-ups/steps/follow-up-steps";
import { startPictureChecks } from "../images/start-picture-checks";
import { updateCoursesBehind } from "../products/product-releases";
import { laterReviewWorkflow } from "../quality/later-review-workflow";
import { flaggedContentWorkflow } from "../review-flags/flagged-content-workflow";
import {
  countOpenReviewFlagsStep,
  deleteInactiveGuestsStep,
  deleteRetiredStepsStep,
  listDueFreshnessTargetsStep,
  listLessonsForLaterReviewStep,
  listOwedPictureChecksStep,
  purgeEvaluationRunsStep,
  purgeExpiredAuthRecordsStep,
  purgeExpiredVerificationsStep,
  purgeMemoryFactsStep,
  recalibrateItemDifficultiesStep,
} from "./steps/sweep-steps";

const MAX_GUEST_BATCHES = 20;

type SweepCounts = {
  accessRecordsPurged: number;
  courseReleaseUpdates: number;
  sessionsPurged: number;
  evaluationRunsPurged: number;
  flaggedContentStarted: boolean;
  followUpsStarted: number;
  freshnessChecks: number;
  guestsDeleted: number;
  itemsRecalibrated: number;
  laterReviews: number;
  memoryFactsPurged: number;
  pictureChecks: number;
  retiredStepsDeleted: number;
  verificationsPurged: number;
};

export type DailySweepsResult =
  | { runId: string; status: "alreadyRan" }
  | (SweepCounts & { status: "swept" });

function countOf(result: PromiseSettledResult<number>): number {
  return result.status === "fulfilled" ? result.value : 0;
}

async function checkFreshness(): Promise<number> {
  const targets = await listDueFreshnessTargetsStep();
  await Promise.all(targets.map((target) => startFreshnessCheck(target)));

  return targets.length;
}

/** Owed work whose start failed, such as an API that didn't answer the learner's request. */
async function startOldFollowUps(): Promise<number> {
  const userIds = await listLearnersWithOldFollowUpsStep();

  await Promise.all(
    userIds.map((userId) => startOnce(followUpsWorkflow, [{ userId }], getFollowUpsToken(userId))),
  );

  return userIds.length;
}

async function checkOwedPictures(): Promise<number> {
  const assetIds = await listOwedPictureChecksStep();
  await startPictureChecks({ assetIds });

  return assetIds.length;
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

async function sweep(): Promise<SweepCounts> {
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
    courseReleases,
    pictures,
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
    // Also catches an update whose start failed.
    updateCoursesBehind(),
    checkOwedPictures(),
  ]);

  return {
    accessRecordsPurged: access.status === "fulfilled" ? access.value.recordsPurged : 0,
    courseReleaseUpdates: countOf(courseReleases),
    evaluationRunsPurged: countOf(runs),
    flaggedContentStarted: flagged.status === "fulfilled" && flagged.value,
    followUpsStarted: countOf(followUps),
    freshnessChecks: countOf(checks),
    guestsDeleted: countOf(guests),
    itemsRecalibrated: countOf(items),
    laterReviews: countOf(reviews),
    memoryFactsPurged: countOf(facts),
    pictureChecks: countOf(pictures),
    retiredStepsDeleted: countOf(retired),
    sessionsPurged: access.status === "fulfilled" ? access.value.sessionsPurged : 0,
    verificationsPurged: countOf(verifications),
  };
}

/** `executionId` is Vercel's id for one scheduled run, the same in every delivery of it. */
export async function dailySweepsWorkflow({
  executionId,
}: {
  executionId: string;
}): Promise<DailySweepsResult> {
  "use workflow";

  // Vercel can deliver a run again until a day after it was due, and that start can wait in the
  // workflow queue for another day, so the token stays taken for a week from this claim; `using`
  // or `claimRunToken` would free it when the run ends.
  const scheduledRun = createHook({
    experimental_minRetention: "7d",
    token: `daily-sweeps:${executionId}`,
  });

  const conflict = await scheduledRun.getConflict();

  if (conflict) {
    return { runId: conflict.runId, status: "alreadyRan" };
  }

  return { ...(await sweep()), status: "swept" };
}
