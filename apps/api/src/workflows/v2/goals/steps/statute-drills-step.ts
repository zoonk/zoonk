import {
  STATUTE_DRILL_OPTION_COUNT,
  generateStatuteDrills,
} from "@zoonk/ai/tasks/v2/items/statute-drills";
import {
  type StatuteDrillTarget,
  loadStatuteDrillTargets,
  writeStatuteDrills,
} from "@zoonk/core/exams/statutes/drill-targets";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

/** A first set per law: enough for a few days of drills, more as the plan reaches the law. */
const DRILLS_PER_LAW = 12;

export async function loadStatuteDrillTargetsStep(goalId: string): Promise<StatuteDrillTarget[]> {
  "use step";

  return loadStatuteDrillTargets(goalId);
}

/**
 * Writes drills on the letter of one law, in the board's style (Cebraspe's right or wrong, FGV's
 * options), each citing its article and linked to the official text. They join the item bank, so
 * practice, capsules and mocks use them.
 */
export async function prepareStatuteDrillsStep({
  analytics,
  target,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  target: StatuteDrillTarget;
  workflowRunId: string;
}): Promise<number> {
  "use step";

  const { data, provenance } = await withAiRetry(() =>
    generateStatuteDrills({
      analytics: toContentAnalytics({ analytics, scope: { ownerId: null }, workflowRunId }),
      articles: target.articles,
      count: DRILLS_PER_LAW,
      language: target.language,
      law: target.law,
      style: target.style,
    }),
  );

  return writeStatuteDrills({
    drills: data.drills,
    optionCount: STATUTE_DRILL_OPTION_COUNT,
    provenance,
    target,
  });
}
