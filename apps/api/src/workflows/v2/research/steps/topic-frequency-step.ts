import { findTopicFrequency } from "@zoonk/ai/tasks/v2/research/find-topic-frequency";
import {
  findTopicFrequencyLookup,
  recordTopicFrequency,
} from "@zoonk/core/library/exams/record-topic-frequency";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

/** One search per subject: a lookup of every subject at once rated the first ones and left the rest out. */
export async function lookUpTopicFrequencyStep({
  analytics,
  examBlueprintId,
}: {
  analytics: ResearchAnalytics;
  examBlueprintId: string;
}): Promise<void> {
  "use step";

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

  const failed = results.find((result) => result.status === "rejected");

  await recordTopicFrequency({
    complete: !failed,
    examBlueprintId,
    subjects: results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
  });

  if (failed) {
    throw failed.reason;
  }
}
