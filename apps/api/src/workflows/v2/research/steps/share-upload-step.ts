import { findOfficialSources } from "@zoonk/ai/tasks/v2/research/find-official-sources";
import { type UploadVisibility } from "@zoonk/ai/tasks/v2/research/upload-visibility";
import { type SharedUpload, shareSourceUpload } from "@zoonk/core/library/sources/share-upload";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";
import { isSameDocumentTitle } from "../_utils/title-match";

const ANY_COUNTRY = "ZZ";

/** Only the title and publisher are searched, never the file's content. */
export async function confirmPublicDocumentStep({
  analytics,
  decision,
}: {
  analytics: ResearchAnalytics;
  decision: UploadVisibility;
}): Promise<{ url: string } | null> {
  "use step";

  const { data } = await withAiRetry(() =>
    findOfficialSources({
      analytics,
      plan: {
        board: decision.publisher,
        country: ANY_COUNTRY,
        edition: null,
        name: decision.title,
        officialDomains: [],
        queries: [[decision.title, decision.publisher].filter(Boolean).join(" ")],
        role: null,
      },
    }),
  );

  const match = data.documents.find(
    (document) =>
      document.kind === "official" &&
      isSameDocumentTitle({ found: document.title, uploaded: decision.title }),
  );

  return match ? { url: match.url } : null;
}

export async function shareUploadStep({
  decision,
  sourceId,
  url,
}: {
  decision: UploadVisibility;
  sourceId: string;
  url: string;
}): Promise<SharedUpload | null> {
  "use step";

  return shareSourceUpload({
    language: decision.language,
    publisher: decision.publisher,
    sourceId,
    title: decision.title,
    url,
  });
}
