import { type FreshnessTarget } from "@zoonk/core/library/exams/check-freshness";
import { scheduleFreshnessChecks } from "@zoonk/core/library/exams/freshness-checks";

export async function scheduleFreshnessChecksStep(targets: FreshnessTarget[]): Promise<void> {
  "use step";

  await scheduleFreshnessChecks({ targets });
}
