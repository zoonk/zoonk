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

/**
 * Stores one document research found, in a step of its own, so a download that fails (a board's
 * site that timed out) is retried alone. The Library's copy is reused when another address holds
 * the same document, so a retry, or the next learner with the same goal, never stores it twice. A
 * document that still fails once its retries run out (removed, too large, blocked) is left out.
 */
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

/** The first time each source appears: two addresses can hold the Library's same copy. */
function uniqueSources(sources: StoredSource[]): StoredSource[] {
  return sources.filter(
    (source, index) => sources.findIndex((other) => other.sourceId === source.sourceId) === index,
  );
}

/**
 * The stored documents a model can read, each once, in search order. Every one search found is
 * stored (it finds six at most) and read: a language certificate sets out each section on a page
 * of its own (IELTS's Reading page alone states its 40 questions), which search may list after
 * marking guides. An official page that builds its text with JavaScript stores nothing, so it's
 * left out.
 */
export async function keepReadableSourcesStep(stored: StoredSource[]): Promise<StoredSource[]> {
  "use step";

  const readable = new Set(await listReadableSourceIds(stored.map((source) => source.sourceId)));

  return uniqueSources(stored.filter((source) => readable.has(source.sourceId)));
}
