import { type FoundSourceDocument } from "@zoonk/ai/tasks/v2/research/find-official-sources";
import { type SourceTopic } from "@zoonk/core/library/sources/contract";
import {
  findWebSourceCopy,
  listReadableSourceIds,
  storeWebSource,
} from "@zoonk/core/library/sources/web";
import { logError } from "@zoonk/utils/logger";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

/** The notice, its corrections and the syllabus are what extraction needs; more only costs tokens. */
const MAX_STORED_SOURCES = 4;

export type StoredSource = {
  documentType: FoundSourceDocument["documentType"];
  kind: "official" | "secondary";
  sourceId: string;
};

/** A copy the Library already holds is reused as is; anything else is fetched and stored. */
async function storeOrReuse({
  copyId,
  document,
  language,
  topic,
}: {
  copyId: string | null;
  document: FoundSourceDocument;
  language: string;
  topic: SourceTopic;
}): Promise<{ id: string }> {
  if (copyId) {
    return { id: copyId };
  }

  return storeWebSource({
    kind: document.kind,
    language,
    publisher: document.publisher,
    title: document.title,
    topic,
    url: document.url,
  });
}

/** The first time each source appears: two addresses can hold the Library's same copy. */
function uniqueSources(sources: StoredSource[]): StoredSource[] {
  return sources.filter(
    (source, index) => sources.findIndex((other) => other.sourceId === source.sourceId) === index,
  );
}

/**
 * Fetches and stores each document research found, once per document: the Library's copy is
 * reused when another address holds the same document, so the next learner with the same goal
 * reuses them. A document that fails to download (removed, too large, blocked) is skipped; the
 * rest still count. Every document search found is fetched (it finds six at most), and only
 * those a model can read take one of the reading slots, in search order: an official page that
 * builds its text with JavaScript stores nothing, and would otherwise push the notice out.
 */
export async function storeSourcesStep({
  analytics,
  documents,
  language,
  topic,
}: {
  analytics?: ResearchAnalytics;
  documents: FoundSourceDocument[];
  language: string;
  topic: SourceTopic;
}): Promise<StoredSource[]> {
  "use step";

  const copies = await withAiRetry(() =>
    Promise.all(
      documents.map((document) =>
        findWebSourceCopy({
          analytics,
          language,
          publisher: document.publisher,
          title: document.title,
          url: document.url,
        }),
      ),
    ),
  );

  const results = await Promise.allSettled(
    documents.map((document, index) =>
      storeOrReuse({ copyId: copies[index] ?? null, document, language, topic }),
    ),
  );

  const stored = results.flatMap((result, index) => {
    const document = documents[index];

    if (result.status === "rejected" || !document) {
      logError(
        `Research couldn't store ${document?.url ?? "a document"}.`,
        result.status === "rejected" ? result.reason : null,
      );

      return [];
    }

    return [
      { documentType: document.documentType, kind: document.kind, sourceId: result.value.id },
    ];
  });

  const readable = new Set(await listReadableSourceIds(stored.map((source) => source.sourceId)));

  return uniqueSources(stored.filter((source) => readable.has(source.sourceId))).slice(
    0,
    MAX_STORED_SOURCES,
  );
}
