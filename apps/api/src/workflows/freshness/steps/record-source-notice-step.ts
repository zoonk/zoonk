import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { generateSourceChangeNotice } from "@zoonk/ai/tasks/research/source-change-notice";
import { type SourceChange } from "@zoonk/core/library/exams/check-freshness";
import { recordSourceChangeNotice } from "@zoonk/core/library/sources/notices";
import { type ResearchAnalytics } from "../../research/_utils/research-analytics";

export async function recordSourceNoticeStep({
  analytics,
  change,
}: {
  analytics: ResearchAnalytics;
  change: SourceChange;
}): Promise<string | null> {
  "use step";

  const { data, provenance } = await generateSourceChangeNotice({
    analytics,
    changes: change.change,
    language: change.language,
    serviceTier: chooseServiceTier({ wait: "later" }),
    source: change.title,
  });

  const notice = await recordSourceChangeNotice({
    changedAt: change.changedAt,
    contentHash: change.contentHash,
    fields: ["text"],
    language: change.language,
    message: data.message,
    previousHash: change.previousHash,
    provenance,
    sourceId: change.sourceId,
  });

  return notice?.id ?? null;
}
