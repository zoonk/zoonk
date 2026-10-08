import { type FreshnessTarget } from "@zoonk/core/library/exams/check-freshness";
import { scheduleFreshnessChecks } from "@zoonk/core/library/exams/freshness-checks";

/** A goal now relies on these: the daily sweep checks them from its next run on. */
export async function scheduleFreshnessChecksStep(targets: FreshnessTarget[]): Promise<void> {
  "use step";

  await scheduleFreshnessChecks({ targets });
}
