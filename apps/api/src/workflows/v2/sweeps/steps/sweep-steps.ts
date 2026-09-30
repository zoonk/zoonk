import { purgeEvaluationRuns } from "@zoonk/core/evaluation-runs/purge";
import { deleteInactiveGuests } from "@zoonk/core/guests/delete-inactive";
import { type FreshnessTarget } from "@zoonk/core/library/exams/check-freshness";
import { listDueFreshnessTargets } from "@zoonk/core/library/exams/freshness-checks";
import { recalibrateItemDifficulties } from "@zoonk/core/library/items/recalibrate";
import { listLessonsForLaterReview } from "@zoonk/core/library/quality/later-reviews";
import { countOpenReviewFlags } from "@zoonk/core/library/review-flags/flagged";
import { purgeMemoryFacts } from "@zoonk/core/memory/purge";

export async function listDueFreshnessTargetsStep(): Promise<FreshnessTarget[]> {
  "use step";

  return listDueFreshnessTargets();
}

/** One batch of inactive guests per step, so each step stays within a function's time. */
export async function deleteInactiveGuestsStep(): Promise<number> {
  "use step";

  const { deleted } = await deleteInactiveGuests();
  return deleted;
}

export async function purgeMemoryFactsStep(): Promise<number> {
  "use step";

  const { purged } = await purgeMemoryFacts();
  return purged;
}

export async function purgeEvaluationRunsStep(): Promise<number> {
  "use step";

  const { purged } = await purgeEvaluationRuns();
  return purged;
}

export async function listLessonsForLaterReviewStep(): Promise<string[]> {
  "use step";

  return listLessonsForLaterReview();
}

export async function recalibrateItemDifficultiesStep(): Promise<number> {
  "use step";

  const { recalibrated } = await recalibrateItemDifficulties();
  return recalibrated;
}

export async function countOpenReviewFlagsStep(): Promise<number> {
  "use step";

  return countOpenReviewFlags();
}
