import { findChoiceOptions } from "@zoonk/ai/tasks/v2/research/find-choice-options";
import {
  findChoiceOptionsLookup,
  recordChoiceOptions,
} from "@zoonk/core/library/exams/record-choice-options";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

export async function lookUpChoiceOptionsStep({
  analytics,
  examBlueprintId,
}: {
  analytics: ResearchAnalytics;
  examBlueprintId: string;
}): Promise<void> {
  "use step";

  const lookup = await findChoiceOptionsLookup({ examBlueprintId });

  if (!lookup) {
    return;
  }

  const { data } = await withAiRetry(() =>
    findChoiceOptions({
      ...lookup,
      analytics,
      today: new Date().toISOString().slice(0, "YYYY-MM-DD".length),
    }),
  );

  await recordChoiceOptions({
    edition: data.edition,
    examBlueprintId,
    options: data.options,
    source: data.source,
  });
}
