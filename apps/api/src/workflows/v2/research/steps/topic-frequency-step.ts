import { findTopicFrequency } from "@zoonk/ai/tasks/v2/research/find-topic-frequency";
import {
  findTopicFrequencyLookup,
  recordTopicFrequency,
} from "@zoonk/core/library/exams/record-topic-frequency";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

/**
 * For a notice whose documents don't say how often the exam asks its topics (ENEM's contents),
 * how often its past papers asked each one, looked up once and stored on the blueprint: a plan
 * short on time leaves out the topics asked least first. One search per subject, side by side: a
 * lookup of every subject at once rated the first ones and left ENEM's sciences out. What the
 * searches found is stored even when one fails, and the failure throws, so the runtime retries the
 * step, which looks up only the subjects still missing (`recordTopicFrequency`). The frequency only
 * adds to the notice, so research goes on when the retries run out, and the next learner's
 * research asks for the rest.
 */
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
