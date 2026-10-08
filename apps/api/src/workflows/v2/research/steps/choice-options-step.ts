import { findChoiceOptions } from "@zoonk/ai/tasks/v2/research/find-choice-options";
import {
  findChoiceOptionsLookup,
  recordChoiceOptions,
} from "@zoonk/core/library/exams/record-choice-options";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

/**
 * For a notice that says its questions are multiple choice without how many options (the Enem's
 * page says "180 questões objetivas"), how many its latest edition had, looked up once and stored
 * on the blueprint: questions for the exam are written and picked with that many, so ENEM's never
 * have four. The count only adds to the notice, so a lookup that fails is logged and tried again
 * by the next learner's research.
 */
export async function lookUpChoiceOptionsStep({
  analytics,
  examBlueprintId,
}: {
  analytics: ResearchAnalytics;
  examBlueprintId: string;
}): Promise<void> {
  "use step";

  const { error } = await safeAsync(async () => {
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
  });

  if (error) {
    logError(`The options of exam blueprint ${examBlueprintId} couldn't be looked up:`, error);
  }
}
