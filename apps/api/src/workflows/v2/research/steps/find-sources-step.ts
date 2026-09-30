import {
  type FoundSourceDocument,
  findOfficialSources,
} from "@zoonk/ai/tasks/v2/research/find-official-sources";
import { type ResearchPlan, type ResearchTopic } from "@zoonk/ai/tasks/v2/research/plan";
import { toSourceUrl } from "@zoonk/core/library/sources/fetch";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

/** Official documents first, each public address once. */
function selectDocuments(documents: FoundSourceDocument[]): FoundSourceDocument[] {
  const withUrls = documents.flatMap((document) => {
    const url = toSourceUrl(document.url);
    return url ? [{ ...document, url }] : [];
  });

  const unique = [...new Map(withUrls.map((document) => [document.url, document])).values()];

  return unique.toSorted(
    (first, second) => Number(second.kind === "official") - Number(first.kind === "official"),
  );
}

/**
 * Searches official domains first for the current notice, law or
 * documentation, or a subject's reference syllabi. The search tool is the
 * eval's pick (see the `find-official-sources` eval); the step keeps only
 * public addresses.
 */
export async function findSourcesStep({
  analytics,
  plan,
  topic,
}: {
  analytics: ResearchAnalytics;
  plan: ResearchPlan;
  topic: ResearchTopic;
}): Promise<{ documents: FoundSourceDocument[]; officialFound: boolean }> {
  "use step";

  const { data } = await withAiRetry(() => findOfficialSources({ analytics, plan, topic }));

  return { documents: selectDocuments(data.documents), officialFound: data.officialFound };
}
