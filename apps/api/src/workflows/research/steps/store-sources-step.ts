import { generateSearchTerms } from "@zoonk/ai/tasks/identity/search-terms";
import { type FoundSourceDocument } from "@zoonk/ai/tasks/research/find-official-sources";
import { type SourceTopic } from "@zoonk/core/library/sources/contract";
import { PermanentDocumentError } from "@zoonk/core/library/sources/fetch";
import {
  findWebSourceCopy,
  getWebSourceSearchSubject,
  listReadableSourceIds,
  storeWebSource,
} from "@zoonk/core/library/sources/web";
import { safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { type ResearchAnalytics } from "../_utils/research-analytics";

export type StoredSource = {
  documentType: FoundSourceDocument["documentType"];
  kind: "official" | "secondary";
  sourceId: string;
};

type StoreSourceInput = {
  analytics?: ResearchAnalytics;
  document: FoundSourceDocument;
  language: string;
  topic: SourceTopic;
};

async function sourceSearchSubjectStep(input: StoreSourceInput) {
  "use step";
  return getWebSourceSearchSubject({ ...input.document, language: input.language });
}

async function sourceSearchTermsStep(input: Parameters<typeof generateSearchTerms>[0]) {
  "use step";
  const { data } = await generateSearchTerms(input);
  return data.subjects[0]?.terms ?? [];
}

async function findSourceCopyStep({
  input,
  searchTerms,
}: {
  input: StoreSourceInput;
  searchTerms: string[];
}) {
  "use step";

  return findWebSourceCopy({
    ...input.document,
    analytics: input.analytics,
    language: input.language,
    searchTerms,
  });
}

async function storeDownloadedSourceStep(input: StoreSourceInput): Promise<string> {
  "use step";

  const { data, error } = await safeAsync(() =>
    storeWebSource({ ...input.document, language: input.language, topic: input.topic }),
  );

  if (error instanceof PermanentDocumentError) {
    throw new FatalError(error.message);
  }

  if (error) {
    throw error;
  }

  return data.id;
}

export async function storeSource(input: StoreSourceInput): Promise<StoredSource> {
  const subject = await sourceSearchSubjectStep(input);

  const copyId = subject
    ? await findSourceCopyStep({
        input,
        searchTerms: await sourceSearchTermsStep({
          analytics: input.analytics,
          subjects: [subject],
        }),
      })
    : null;

  const sourceId = copyId ?? (await storeDownloadedSourceStep(input));
  return { documentType: input.document.documentType, kind: input.document.kind, sourceId };
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
