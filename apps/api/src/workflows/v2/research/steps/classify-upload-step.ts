import {
  type UploadVisibility,
  classifyUploadVisibility,
} from "@zoonk/ai/tasks/v2/research/upload-visibility";
import { loadSourceDocuments } from "@zoonk/core/library/sources/load-documents";
import { type ResearchAnalytics } from "../_utils/research-analytics";

export async function classifyUploadStep({
  analytics,
  sourceId,
}: {
  analytics: ResearchAnalytics;
  sourceId: string;
}): Promise<UploadVisibility | null> {
  "use step";

  const [document] = await loadSourceDocuments([sourceId]);

  if (!document) {
    return null;
  }

  const { data } = await classifyUploadVisibility({
    analytics,
    document,
    fileName: document.title,
  });

  return data;
}
