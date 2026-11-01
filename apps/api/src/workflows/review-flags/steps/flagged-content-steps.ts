import {
  STATUTE_DRILL_OPTION_COUNT,
  generateStatuteDrills,
} from "@zoonk/ai/tasks/items/statute-drills";
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

export async function rewriteFlaggedDrillsStep({
  group,
  workflowRunId,
}: {
  group: FlaggedDrillGroup;
  workflowRunId: string;
}): Promise<number> {
  "use step";

  const { data, provenance } = await generateStatuteDrills({
    analytics: { contentScope: "shared", traceId: workflowRunId },
    articles: [group.article],
    count: group.itemIds.length,
    fillInTheBlank: group.format === "typed",
    language: group.language,
    law: group.law,
    style: group.style,
  });

  return replaceFlaggedDrills({
    drills: data.drills,
    group,
    optionCount: STATUTE_DRILL_OPTION_COUNT,
    provenance,
  });
}

export async function recordFailedDrillRewriteStep(group: FlaggedDrillGroup): Promise<void> {
  "use step";
  await recordFailedDrillRewrites({ itemIds: group.itemIds, preparedAt: group.preparedAt });
}
