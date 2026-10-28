import { type FoundSourceDocument } from "@zoonk/ai/tasks/v2/research/find-official-sources";
import { type SourceTopic } from "@zoonk/core/library/sources/contract";
import {
  findWebSourceCopy,
  listReadableSourceIds,
  storeWebSource,
} from "@zoonk/core/library/sources/web";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

export type StoredSource = {
  documentType: FoundSourceDocument["documentType"];
  kind: "official" | "secondary";
  sourceId: string;
};

export async function storeSourceStep({
  analytics,
  document,
  language,
  topic,
}: {
  analytics?: ResearchAnalytics;
  document: FoundSourceDocument;
  language: string;
  topic: SourceTopic;
}): Promise<StoredSource> {
  "use step";

  const copyId = await withAiRetry(() =>
    findWebSourceCopy({
      analytics,
      language,
      publisher: document.publisher,
      title: document.title,
      url: document.url,
    }),
  );

  const { id } = copyId
    ? { id: copyId }
    : await storeWebSource({
        kind: document.kind,
        language,
        publisher: document.publisher,
        title: document.title,
        topic,
        url: document.url,
      });

  return { documentType: document.documentType, kind: document.kind, sourceId: id };
}

function uniqueSources(sources: StoredSource[]): StoredSource[] {
  return sources.filter(
    (source, index) => sources.findIndex((other) => other.sourceId === source.sourceId) === index,
  );
}

export async function keepReadableSourcesStep(stored: StoredSource[]): Promise<StoredSource[]> {
  "use step";

  const readable = new Set(await listReadableSourceIds(stored.map((source) => source.sourceId)));

  return uniqueSources(stored.filter((source) => readable.has(source.sourceId)));
}
