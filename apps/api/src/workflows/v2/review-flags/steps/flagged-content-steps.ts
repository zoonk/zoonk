import {
  STATUTE_DRILL_OPTION_COUNT,
  generateStatuteDrills,
} from "@zoonk/ai/tasks/v2/items/statute-drills";
import { replaceFlaggedDrills } from "@zoonk/core/library/review-flags/drills";
import {
  type FlaggedContent,
  type FlaggedDrillGroup,
  listFlaggedContent,
} from "@zoonk/core/library/review-flags/flagged";
import { withAiRetry } from "../../_shared/ai-retry";

export async function listFlaggedContentStep(input: {
  flagIds?: string[];
}): Promise<FlaggedContent> {
  "use step";

  return listFlaggedContent(input);
}

/**
 * Writes one changed article's drills again from its new text, in the board style of their
 * format, and puts them in place of the flagged ones.
 */
export async function rewriteFlaggedDrillsStep({
  group,
  workflowRunId,
}: {
  group: FlaggedDrillGroup;
  workflowRunId: string;
}): Promise<number> {
  "use step";

  const { data, provenance } = await withAiRetry(() =>
    generateStatuteDrills({
      analytics: { contentScope: "shared", traceId: workflowRunId },
      articles: [group.article],
      count: group.itemIds.length,
      language: group.language,
      law: group.law,
      style: group.style,
    }),
  );

  return replaceFlaggedDrills({
    drills: data.drills,
    group,
    optionCount: STATUTE_DRILL_OPTION_COUNT,
    provenance,
  });
}
