import {
  type FreshnessCheck,
  type FreshnessTarget,
  checkFreshness,
} from "@zoonk/core/library/exams/check-freshness";

export async function checkFreshnessStep(target: FreshnessTarget): Promise<FreshnessCheck> {
  "use step";

  return checkFreshness({ target });
}
