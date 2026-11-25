import {
  type UploadVisibility,
  classifyUploadVisibility,
} from "@zoonk/ai/tasks/research/upload-visibility";
import { loadUploadForVisibility } from "@zoonk/core/library/sources/load-documents";
import { type ResearchAnalytics } from "../_utils/research-analytics";

export async function classifyUploadStep({
  analytics,
  ownerId,
  sourceId,
}: {
  analytics: ResearchAnalytics;
  ownerId: string;
  sourceId: string;
}): Promise<UploadVisibility | null> {
  "use step";

  const document = await loadUploadForVisibility({ ownerId, sourceId });

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
