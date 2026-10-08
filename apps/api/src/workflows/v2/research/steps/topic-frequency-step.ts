import { findTopicFrequency } from "@zoonk/ai/tasks/v2/research/find-topic-frequency";
import {
  findTopicFrequencyLookup,
  recordTopicFrequency,
} from "@zoonk/core/library/exams/record-topic-frequency";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

/**
 * For a notice whose documents don't say how often the exam asks its topics (ENEM's contents),
 * how often its past papers asked each one, looked up once and stored on the blueprint: a plan
 * short on time leaves out the topics asked least first. One search per subject, side by side: a
 * lookup of every subject at once rated the first ones and left ENEM's sciences out. The frequency
 * only adds to the notice, so a lookup that fails is logged and tried again by the next learner's
 * research.
 */
export async function lookUpTopicFrequencyStep({
  analytics,
  examBlueprintId,
}: {
  analytics: ResearchAnalytics;
  examBlueprintId: string;
}): Promise<void> {
  "use step";

  const { error } = await safeAsync(async () => {
    const lookup = await findTopicFrequencyLookup({ examBlueprintId });

    if (!lookup) {
      return;
    }

    const today = new Date().toISOString().slice(0, "YYYY-MM-DD".length);

    const results = await Promise.allSettled(
      lookup.subjects.map(async (subject) => {
        const { data } = await withAiRetry(() =>
          findTopicFrequency({ ...lookup, analytics, subjects: [subject], today }),
        );

        return data.subjects;
      }),
    );

    await recordTopicFrequency({
      examBlueprintId,
      subjects: results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
    });

    const failed = results.find((result) => result.status === "rejected");

    if (failed) {
      throw failed.reason;
    }
  });

  if (error) {
    logError(
      `How often the topics of exam blueprint ${examBlueprintId} are asked couldn't be looked up:`,
      error,
    );
  }
}
