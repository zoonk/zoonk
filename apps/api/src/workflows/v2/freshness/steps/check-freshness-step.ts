import {
  type FreshnessCheck,
  type FreshnessTarget,
  checkFreshness,
} from "@zoonk/core/library/exams/check-freshness";

/** A fetch and a hash compare: no model runs here. Dates are computed in the step, not the workflow. */
export async function checkFreshnessStep(target: FreshnessTarget): Promise<FreshnessCheck> {
  "use step";

  return checkFreshness({ target });
}
