import {
  type FoundSourceDocument,
  findOfficialSources,
} from "@zoonk/ai/tasks/v2/research/find-official-sources";
import { type ExamResearchPlan, type ResearchTopic } from "@zoonk/ai/tasks/v2/research/plan";
import { type SourceResearchPlan } from "@zoonk/ai/tasks/v2/research/source-plan";
import { toSourceUrl } from "@zoonk/core/library/sources/fetch";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

/** Copies of documents that couldn't be downloaded: the prompt asks for 3 at most. */
const MAX_COPIES = 3;

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

function getSite(url: string): string {
  return new URL(url).hostname.replace(/^www\./u, "");
}

/**
 * Copies only from sites that let the app download them: never an unreadable site again, nor
 * another of its addresses (vunesp.com.br's pages and documento.vunesp.com.br's files both refuse).
 */
function selectCopies({
  documents,
  unreadable,
}: {
  documents: FoundSourceDocument[];
  unreadable: readonly string[];
}): FoundSourceDocument[] {
  const blocked = unreadable.map((url) => getSite(url));

  const isBlocked = (url: string) => {
    const site = getSite(url);
    return blocked.some((other) => site === other || site.endsWith(`.${other}`));
  };

  return selectDocuments(documents)
    .filter((document) => !isBlocked(document.url))
    .slice(0, MAX_COPIES);
}

/**
 * Searches official domains first for the current notice, law or
 * documentation, or a subject's reference syllabi. The search tool is the
 * eval's pick (see the `find-official-sources` eval); the step keeps only
 * public addresses. Given documents that couldn't be downloaded (`unreadable`),
 * it searches for copies of them on other sites instead.
 */
export async function findSourcesStep({
  analytics,
  plan,
  topic,
  unreadable = [],
}: {
  analytics: ResearchAnalytics;
  plan: ExamResearchPlan | SourceResearchPlan;
  topic: ResearchTopic;
  unreadable?: string[];
}): Promise<{ documents: FoundSourceDocument[]; officialFound: boolean }> {
  "use step";

  const { data } = await withAiRetry(() =>
    findOfficialSources({ analytics, plan, topic, unreadable }),
  );

  const documents =
    unreadable.length > 0
      ? selectCopies({ documents: data.documents, unreadable })
      : selectDocuments(data.documents);

  return { documents, officialFound: data.officialFound };
}
