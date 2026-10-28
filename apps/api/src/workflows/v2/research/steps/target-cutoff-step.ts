import { findTargetCutoff } from "@zoonk/ai/tasks/v2/research/find-target-cutoff";
import { findTargetCutoffLookup, recordTargetCutoff } from "@zoonk/core/exams/cutoffs/research";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

export async function lookUpTargetCutoffStep({
  analytics,
  goalId,
}: {
  analytics: ResearchAnalytics;
  goalId: string;
}): Promise<void> {
  "use step";

  const now = new Date();
  const today = now.toISOString().slice(0, "YYYY-MM-DD".length);
  const lookup = await findTargetCutoffLookup({ goalId, year: now.getUTCFullYear() });

  if (!lookup) {
    return;
  }

  const { data, provenance } = await withAiRetry(() =>
    findTargetCutoff({
      analytics,
      course: lookup.course,
      exam: lookup.exam,
      institution: lookup.institution,
      position: lookup.position,
      today,
    }),
  );

  await recordTargetCutoff({ finding: data, lookup, provenance });
}
