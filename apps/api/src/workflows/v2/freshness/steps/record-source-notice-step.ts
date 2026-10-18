import { generateSourceChangeNotice } from "@zoonk/ai/tasks/v2/research/source-change-notice";
import { type SourceChange } from "@zoonk/core/library/exams/check-freshness";
import { recordSourceChangeNotice } from "@zoonk/core/library/sources/notices";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../../research/_utils/research-analytics";

/**
 * Writes the one line learners of a changed law or product see on Today. A
 * change that only moved lines around has no excerpt and gets no notice.
 */
export async function recordSourceNoticeStep({
  analytics,
  change,
}: {
  analytics: ResearchAnalytics;
  change: SourceChange;
}): Promise<string | null> {
  "use step";

  const changes = change.change;

  if (!changes) {
    return null;
  }

  const { data, provenance } = await withAiRetry(() =>
    generateSourceChangeNotice({
      analytics,
      changes,
      language: change.language,
      source: change.title,
    }),
  );

  const notice = await recordSourceChangeNotice({
    contentHash: change.contentHash,
    fields: ["text"],
    language: change.language,
    message: data.message,
    previousHash: change.previousHash,
    provenance,
    sourceId: change.sourceId,
  });

  return notice.id;
}
