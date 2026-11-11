import {
  STATUTE_DRILL_OPTION_COUNT,
  type StatuteDrill,
  generateStatuteDrills,
} from "@zoonk/ai/tasks/items/statute-drills";
import { checkStatuteDrillKeys } from "@zoonk/core/exams/statutes/drill-targets";
import { type KeyCheckedItem } from "@zoonk/core/library/items/check-keys";
import { replaceFlaggedDrills } from "@zoonk/core/library/review-flags/drills";
import {
  type FlaggedContent,
  type FlaggedDrillGroup,
  prepareFlaggedContent,
  recordFailedDrillRewrites,
} from "@zoonk/core/library/review-flags/flagged";

export async function prepareFlaggedContentStep(input: {
  flagIds?: string[];
}): Promise<FlaggedContent> {
  "use step";

  return prepareFlaggedContent(input);
}

type FlaggedDrillsRewrite = { group: FlaggedDrillGroup; workflowRunId: string };

type WrittenDrills = Awaited<ReturnType<typeof generateStatuteDrills>>;

function toDrillAnalytics(workflowRunId: string) {
  return { contentScope: "shared", traceId: workflowRunId } as const;
}

async function writeFlaggedDrillsStep({
  group,
  workflowRunId,
}: FlaggedDrillsRewrite): Promise<{
  drills: StatuteDrill[];
  provenance: WrittenDrills["provenance"];
}> {
  "use step";

  const { data, provenance } = await generateStatuteDrills({
    analytics: toDrillAnalytics(workflowRunId),
    articles: [group.article],
    count: group.itemIds.length,
    fillInTheBlank: group.format === "typed",
    language: group.language,
    law: group.law,
    style: group.style,
  });

  return { drills: data.drills, provenance };
}

async function checkFlaggedDrillsStep({
  drills,
  group,
  workflowRunId,
}: FlaggedDrillsRewrite & { drills: StatuteDrill[] }): Promise<KeyCheckedItem<StatuteDrill>[]> {
  "use step";

  return checkStatuteDrillKeys({
    analytics: toDrillAnalytics(workflowRunId),
    articles: [group.article],
    drills,
    language: group.language,
    law: group.law,
    optionCount: STATUTE_DRILL_OPTION_COUNT,
  });
}

async function replaceFlaggedDrillsStep({
  drills,
  group,
  provenance,
}: FlaggedDrillsRewrite & {
  drills: KeyCheckedItem<StatuteDrill>[];
  provenance: WrittenDrills["provenance"];
}): Promise<number> {
  "use step";

  return replaceFlaggedDrills({
    drills,
    group,
    optionCount: STATUTE_DRILL_OPTION_COUNT,
    provenance,
  });
}

export async function rewriteFlaggedDrills(input: FlaggedDrillsRewrite): Promise<number> {
  const { drills, provenance } = await writeFlaggedDrillsStep(input);
  const kept = await checkFlaggedDrillsStep({ ...input, drills });

  return replaceFlaggedDrillsStep({ ...input, drills: kept, provenance });
}

export async function recordFailedDrillRewriteStep(group: FlaggedDrillGroup): Promise<void> {
  "use step";
  await recordFailedDrillRewrites({ itemIds: group.itemIds, preparedAt: group.preparedAt });
}
